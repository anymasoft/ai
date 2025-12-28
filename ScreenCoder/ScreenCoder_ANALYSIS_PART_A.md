# УЗКИЙ АУДИТ ScreenCoder - ЧАСТЬ A: АРХИТЕКТУРА И МАГИЯ ГЕНЕРАЦИИ

## 1. PIPELINE SCREENCODER (ТОЧНАЯ ПОСЛЕДОВАТЕЛЬНОСТЬ)

```
block_parsor.py (Step 1)
    ↓ API Call #1: Detect layout blocks
    └─ PROMPT_MERGE → LLM (Doubao/Qwen/GPT)
       Returns: "header: <bbox>x1 y1 x2 y2</bbox>" etc.
    └─ parse_bboxes() → {header, sidebar, navigation, main_content} coords
    └─ resolve_containment() → Remove overlapping boxes
    └─ Output: data/tmp/test1_bboxes.json

html_generator.py (Step 2)
    ↓ Load bboxes.json
    └─ Create tree structure with ABSOLUTE pixel coordinates
    └─ generate_code_parallel() → For EACH leaf node:
       ├─ Crop image to bbox
       ├─ encode_image(cropped)
       ├─ Call LLM with COMPONENT-SPECIFIC PROMPT (sidebar/header/nav/main)
       │  Temperature: 0, max_tokens: 4096
       │  Returns: Raw HTML+Tailwind CSS (no img tags yet, just <div> with gray placeholders)
       └─ Generate HTML layout with absolute positioning (CSS %)
    └─ code_substitution() → Replace div placeholders with generated HTML
    └─ Output: data/output/test1_layout.html (HTML with inline CSS)

image_box_detection.py (Step 3)  ← CRITICAL: Browser Rendering!
    ↓ Launch Playwright (headless Chrome)
    └─ GET actual rendered layout on 1280x720 viewport
    └─ Use JavaScript to find:
       ├─ All <div class="box[id]"> elements (regions)
       ├─ All <div class="bg-gray-400"> elements (placeholders from generated code)
       └─ Query getBoundingClientRect() for ACTUAL browser coordinates
    └─ Calculate scaling factors: scale_x = W_original / W_layout, scale_y = H_original / H_layout
    └─ Map placeholders back to original image coordinates
    └─ Output: data/tmp/test1_bboxes.json (gray placeholder locations in ORIGINAL image)

UIED/run_single.py (Step 4)
    ↓ Run UI Element Detection (PaddleOCR + CNN)
    └─ Detects ALL visual components:
       ├─ Buttons, text, images, icons
       ├─ Assigns each detection: id, bbox (x,y,w,h), component_type
    └─ Filter by min size (10px)
    └─ Output: data/output/test1_ui_detected.json (list of {id, bbox, type})

mapping.py (Step 5)
    ↓ Match placeholders (from Step 3) with UIED detections (from Step 4)
    └─ For each gray placeholder:
       ├─ Find closest UIED detection using Complete IoU (CIoU)
       └─ CIoU = IoU - distance_penalty - aspect_ratio_penalty
    └─ Use Hungarian algorithm (linear_sum_assignment) for optimal matching
    └─ Output: JSON mapping {region_id → {placeholder_id → uied_id}}

image_replacer.py (Step 6)
    ↓ Replace gray placeholders with ACTUAL CROPPED IMAGES
    └─ For each placeholder (from mapping):
       ├─ Get corresponding UIED bbox
       ├─ Crop original screenshot at UIED coords
       ├─ Scale crop using scale factors (to handle viewport mismatches)
       └─ Save crop as PNG
    └─ Use BeautifulSoup to find all <div class="bg-gray-400"> in HTML
    └─ For each div (in document order):
       ├─ Replace content with <img src="cropped_images/ph0.png">
       └─ Preserve original dimensions
    └─ Output: data/output/test1_layout_final.html (HTML with real cropped images)
```

---

## 2. ПРОМПТЫ, ПАРАМЕТРЫ И ВЫЗОВЫ API

### A. BLOCK DETECTION PROMPT (block_parsor.py, line 10)
```python
PROMPT_MERGE = """Return the bounding boxes of the sidebar, main content, header,
and navigation in this webpage screenshot. Please only return the corresponding
bounding boxes. Note: 1. The areas should not overlap; 2. All text information
and other content should be framed inside; 3. Try to keep it compact without
leaving a lot of blank space; 4. Output a label and the corresponding bounding
box for each line."""
```
**Expected Output Format:**
```
header: <bbox>0 0 1000 150</bbox>
sidebar: <bbox>0 150 200 850</bbox>
navigation: <bbox>200 150 1000 200</bbox>
main content: <bbox>200 200 1000 850</bbox>
```

**Model Calls:**
- **Doubao** (line 319): `Doubao("doubao_api.txt")` → `client.ask(PROMPT_MERGE, encode_image(image_path))`
  - Model: `doubao-1.5-thinking-vision-pro-250428`
  - Temperature: 0 (deterministic)
  - max_tokens: 4096

- **Alternative:** Qwen, GPT, Gemini (all use same interface)

---

### B. CODE GENERATION PROMPTS (html_generator.py, lines 17-49)

**For sidebar (Chinese):**
```python
"这是一个container的截图。这是用户给的额外要求：{user_instruction["sidebar"]}
请填写一段完整的HTML和tail-wind CSS代码以准确再现给定的容器。
请注意所有组块的排版、图标样式、大小、文字信息需要在用户额外条件的基础上与原始截图基本保持一致。
以下是供填写的代码：
<div>
your code here
</div>
只需返回<div>和</div>标签内的代码"
```

**Similar prompts for:**
- header (line 26-32)
- navigation (line 34-40) — "Please use same icons as original screenshot"
- main content (line 42-48) — "Replace images with solid gray blocks of same size"

**Model Calls:**
```python
code = bot.ask(prompt, encode_image(cropped_img))  # Parallel threads (line 175)
```
- Temperature: 0
- max_tokens: 4096
- **CRITICAL:** Each component (header, sidebar, nav, main) gets SEPARATE LLM call!

---

## 3. ПРОМЕЖУТОЧНЫЕ АРТЕФАКТЫ (DATA FLOW)

```
data/
├── input/
│   ├── test1.png (ORIGINAL screenshot)
│   ├── test2.png
│   └── test3.png
│
├── tmp/
│   ├── test1_bboxes.json (Block detection results)
│   │   {
│   │     "header": [0, 0, 1000, 150],
│   │     "sidebar": [0, 150, 200, 850],
│   │     ...
│   │   }
│   │
│   ├── test1_with_bboxes.png (Debug visualization)
│   │
│   └── test1_bboxes.json (After image_box_detection, Step 3)
│       {
│         "regions": [{id: "0", x: 0, y: 0, ...}],
│         "placeholders": [{id: "ph0", region_id: "0", ...}]
│       }
│
└── output/
    ├── test1_layout.html (Step 2 output - with gray placeholders)
    │   <div id="0" class="box" style="...">
    │     <div class="bg-gray-400" style="..."></div>  ← PLACEHOLDER
    │   </div>
    │
    ├── test1_ui_detected.json (UIED output - all detected components)
    │   {
    │     "compos": [
    │       {id: 0, column_min: 50, row_min: 100, width: 200, height: 50, type: "image"},
    │       ...
    │     ],
    │     "img_shape": [H, W, C]
    │   }
    │
    ├── cropped_images/
    │   ├── ph0.png (Cropped from original at UIED bbox)
    │   ├── ph1.png
    │   └── ...
    │
    └── test1_layout_final.html (Final output - with real images)
        <div id="0" class="box" style="...">
          <img src="cropped_images/ph0.png" style="...">  ← REAL IMAGE
        </div>
```

---

## 4. ПОСТПРОЦЕССИНГ И ЗАМЕНА ПЛЕЙСХОЛДЕРОВ (image_replacer.py)

### Phase 1: Crop & Save (lines 8-65)
```python
for region_id, region_data in mapping_data.items():
    for placeholder_id, uied_id in region_data['mapping'].items():
        uied_bbox = uied_boxes[uied_id]  # (x, y, w, h) in UIED coordinate system

        # Scale UIED coords to original image coords
        x_tf = x_proc * scale_x  # scale_x = W_original / W_processed
        y_tf = y_proc * scale_y

        # Crop and save
        cropped_img = original_image[y1:y2, x1:x2]
        cv2.imwrite(f"cropped_images/{placeholder_id}.png", cropped_img)
```

**KEY INSIGHT:** Images are ALWAYS extracted from original screenshot using UIED-detected bboxes!

### Phase 2: Replace in HTML (lines 67-102+)
```python
soup = BeautifulSoup(html_content, 'html.parser')
placeholder_elements = soup.find_all(class_="bg-gray-400")

for i, ph_element in enumerate(placeholder_elements):
    ph_id = ordered_placeholder_ids[i]

    # Create img tag
    img_tag = soup.new_tag('img')
    img_tag['src'] = f'cropped_images/{ph_id}.png'
    img_tag['alt'] = ph_id

    # Replace gray div with img
    ph_element.replace_with(img_tag)
```

**Order matters:** Placeholders matched in DOM order!

---

## 5. КЛЮЧЕВЫЕ ПАРАМЕТРЫ И ПОРОГИ

| Component | File | Parameter | Value | Purpose |
|-----------|------|-----------|-------|---------|
| Block detection | block_parsor.py | PROMPT_MERGE | "Return bboxes..." | Detect layout structure |
| Code generation | html_generator.py | PROMPT_DICT | 4 variants (header/sidebar/nav/main) | Component-specific generation |
| All LLM calls | utils.py | temperature | 0 | Deterministic output |
| All LLM calls | utils.py | max_tokens | 4096 | Limit response length |
| Image filtering | image_box_detection.py | class selector | ".bg-gray-400" | Find generated placeholders |
| Mapping | mapping.py | CIOU_STRICT | -0.9 | Min score for valid match |
| Mapping | mapping.py | FILTER_MIN_WH | 10 | Ignore tiny UIED detections |
| Viewport | image_box_detection.py | viewport | 1280x720 | Fixed rendering size |
| Scaling | image_replacer.py | scale_x, scale_y | W_orig/W_proc | Handle viewport→original mismatch |

---

## 6. "МАГИЯ" ScreenCoder (ЧТО ДЕЛАЕТ ЕГО ЛУЧШЕ ДРУГИХ)

### 1. **Multi-Stage Component Generation**
   - NOT generating entire page at once
   - Instead: Detect layout → Generate EACH section separately → Assemble
   - **Why it works:** Isolated prompts = better focus per component

### 2. **Gray Placeholder Strategy**
   - Generate HTML with placeholder divs (not actual images)
   - Then REPLACE them with real cropped images from original
   - **Why it works:**
     - LLM doesn't need to generate image references
     - Final HTML has ACTUAL pixel-perfect images
     - Avoids "fake" AI-generated images

### 3. **Rendering-Based Detection (Playwright)**
   - After generating HTML, RENDER it in real browser
   - Query actual layout via JavaScript + getBoundingClientRect()
   - Match rendered placeholders to original image
   - **Why it works:**
     - Handles CSS responsive layouts automatically
     - Detects actual visual placement (not just coordinate math)

### 4. **UIED Integration**
   - Separate pass: detect ALL UI components in original
   - Match to generated placeholders using Complete IoU
   - **Why it works:**
     - Ensures cropped images align with actual detected elements
     - Handles layouts that don't fit 4-zone model perfectly

### 5. **Temperature=0 + Component Isolation**
   - Deterministic generation (temperature 0)
   - Each component prompt is very specific
   - **Why it works:**
     - Reproducible results
     - Less hallucination per component

---

## 7. BOTTLENECKS И ПРОБЛЕМЫ

| Issue | Location | Impact | Severity |
|-------|----------|--------|----------|
| **Many API calls** | block_parsor + html_generator | Cost: 1 (layout) + 4+ (components) = 5+ API calls per image | HIGH |
| **Requires Playwright** | image_box_detection | Must install/run browser, slow | MEDIUM |
| **Requires UIED** | UIED/run_single.py | Slow, needs PaddleOCR + CNN models | MEDIUM |
| **Fixed viewport** | image_box_detection.py | 1280x720 hardcoded | LOW-MEDIUM |
| **Mapping complexity** | mapping.py | Hungarian algorithm only if count mismatches | LOW |
| **Chinese prompts** | html_generator.py | Better results in Chinese? Need verification | UNKNOWN |
| **No error recovery** | main.py | If Step 3 fails, whole pipeline stops | MEDIUM |

