<?php
/**
 * Файл для сохранения лидов в текстовые файлы
 * Разместите этот файл в той же папке, что и index.html
 */

header('Content-Type: application/json; charset=utf-8');

// Разрешаем запросы с любого источника (для тестирования)
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Обработка preflight запросов
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

// Проверяем метод запроса
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Метод не поддерживается']);
    exit();
}

// Получаем и декодируем JSON данные
$input = file_get_contents('php://input');
$data = json_decode($input, true);

// Проверяем наличие обязательных полей
if (empty($data['email']) || empty($data['productName']) || empty($data['description'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Не все обязательные поля заполнены']);
    exit();
}

// Валидация email
if (!filter_var($data['email'], FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Некорректный email адрес']);
    exit();
}

// Создаем папку leads, если её нет
$leadsDir = __DIR__ . '/leads';
if (!file_exists($leadsDir)) {
    if (!mkdir($leadsDir, 0755, true)) {
        http_response_code(500);
        echo json_encode(['error' => 'Не удалось создать папку для сохранения лидов']);
        exit();
    }
}

// Формируем имя файла на основе текущей даты и времени
$dateTime = new DateTime();
$fileName = 'lead_' . $dateTime->format('Y-m-d_H-i-s') . '.txt';
$filePath = $leadsDir . '/' . $fileName;

// Форматируем содержимое файла
$content = "--------------------------------\n";
$content .= "Email: " . htmlspecialchars($data['email']) . "\n";
$content .= "Product name: " . htmlspecialchars($data['productName']) . "\n";
$content .= "Description: " . htmlspecialchars($data['description']) . "\n";
$content .= "Date: " . $dateTime->format('Y-m-d H:i:s') . "\n";
$content .= "--------------------------------\n";

// Сохраняем данные в файл
if (file_put_contents($filePath, $content) === false) {
    http_response_code(500);
    echo json_encode(['error' => 'Не удалось сохранить данные']);
    exit();
}

// Возвращаем успешный ответ
http_response_code(200);
echo json_encode([
    'success' => true,
    'message' => 'Данные успешно сохранены',
    'file' => $fileName
]);
?>