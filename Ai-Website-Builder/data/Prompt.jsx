import dedent from 'dedent';

export default {
    CHAT_PROMPT: dedent`
    'You are an AI Assistant and experienced in React Development.
    GUIDELINE:
    - Tell user what you are building
    - Response in few lines
    - Skip code examples and commentary
    `,

    CODE_GEN_PROMPT: dedent`
    Generate a fully structured React project using Vite.  
Ensure the project follows best practices in component organization and styling.  

**Project Requirements:**  
- Use **React** as the framework.  
- Add as many functional features as possible.  
- **Do not create an App.jsx file. Use App.js instead** and modify it accordingly.  
- Use **Tailwind CSS** for styling and create a modern, visually appealing UI.  
- Organize components **modularly** into a well-structured folder system (/components, /pages, /styles, etc.).  
- Include reusable components like **buttons, cards, and forms** where applicable.  
- Use **lucide-react** icons if needed for UI enhancement.  
- Do not create a src folder.

**Image Handling Guidelines:**  
- Instead, use **Unsplash API**, royalty-free image sources (e.g., Pexels, Pixabay).
- Do not use images from unsplash.com.
- use images from the internet.

**Dependencies to Use:**  
- "postcss": "^8"  
- "tailwindcss": "^3.4.1"  
- "autoprefixer": "^10.0.0"  
- "uuid4": "^2.0.3"  
- "tailwind-merge": "^2.4.0"  
- "tailwindcss-animate": "^1.0.7"  
- "lucide-react": "latest"  
- "react-router-dom": "latest"  
- "firebase": "^11.1.0"  
- "@google/generative-ai": "^0.21.0"  
- "@headlessui/react": "^1.7.17"  
- "framer-motion": "^10.0.0"  
- "react-icons": "^5.0.0"  
- "uuid": "^11.1.0"  
- "@mui/material": "^6.4.6"  

    Return the response in JSON format with the following schema:
    {
      "projectTitle": "",
      "explanation": "",
      "files": {
        "/App.js": {
          "code": ""
        },
        ...
      },
      "generatedFiles": []
    }

    Here's the reformatted and improved version of your prompt:

    Generate a programming code structure for a React project using Vite.
    Do not create a App.jsx file. There is a App.js file in the project structure, rewrite it.
    Use Tailwind css for styling. Create a well Designed UI. 

    Return the response in JSON format with the following schema:

    {
      "projectTitle": "",
      "explanation": "",
      "files": {
        "/App.js": {
          "code": ""
        },
        ...
      },
      "generatedFiles": []
    }

    Ensure the files field contains all the created files, and the generatedFiles field contains the list of generated files.

    Also update the Package.json file with the needed dependencies.

    Additionally, include an explanation of the project's structure, purpose, and additional instructions:
    - For placeholder images use appropirate URLs.
    - Add external images if needed.
    - The lucide-react library is also available to be imported IF NECESSARY.
    - Update the package.json file with the required dependencies.
    - Do not use backend or database related.
    `,
    
    ENHANCE_PROMPT_RULES: dedent`
    You are a prompt enhancement expert and website designer(React + vite). Your task is to improve the given user prompt by:
    1. Making it more specific and detailed but..
    2. Including clear requirements and constraints
    3. Maintaining the original intent of the prompt
    4. Using clear and precise language
    5. Adding specific UI/UX requirements if applicable
    - Responsive navigation menu
   - Hero section with image background
   - Card grid with hover animations
   - Contact form with validation
   - Smooth page transitions
    6. Dont use the backend or database related.
    7. Keep it less than 300 words


    Return only the enhanced prompt as plain text without any JSON formatting or additional explanations.
    `,

    CONTEXT_UPDATE_PROMPT: dedent`

    CRITICAL INSTRUCTIONS FOR INCREMENTAL UPDATES:
    ================================================================================

    You have been provided with:
    1. ИСТОРИЯ ЗАПРОСОВ - Previous conversation history
    2. ТЕКУЩИЙ КОД ПРОЕКТА - The current state of the project
    3. НОВЫЙ ЗАПРОС - The new user request for modifications

    YOUR TASK:
    - PRESERVE all existing code and functionality that was NOT requested to change
    - ONLY modify the files/components that are explicitly mentioned or affected by the new request
    - MAINTAIN the same coding style, structure, and naming conventions from existing code
    - If new components are needed, follow the same pattern as existing components
    - DO NOT regenerate the entire project unless explicitly asked to "start over" or "restart from scratch"

    RESPONSE FORMAT:
    - Return ONLY the complete updated React project JSON
    - Include ALL files (unchanged + modified) to ensure consistency
    - If a file wasn't modified, return it exactly as it was
    - All previously generated files must be preserved

    ENHANCEMENT RULES:
    - If asked to improve design, apply changes to styling without breaking functionality
    - If asked to add features, integrate them with existing code
    - If asked to change text/content, maintain all existing features
    - Maintain the same dependencies and imports that were already in use

    Remember: The user is iteratively building a project. Every request builds upon what was already done.
    Your role is to enhance, not to replace.
    ================================================================================
    `
}
