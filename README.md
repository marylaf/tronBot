# tronBot

tronBot — это телеграм-бот для управления кошельками TRON, который позволяет пользователям отслеживать баланс и транзакции, управлять кошельками и получать уведомления о новых транзакциях. Бот написан на Node.js с использованием библиотеки Telegraf, Axios для запросов API и интегрирован с базой данных PostgreSQL.

## Возможности

- **Просмотр баланса и транзакций**: Отображение баланса и истории транзакций кошелька.
- **Управление кошельками**: Добавление, удаление и редактирование названий кошельков.
- **Фильтрация транзакций**: Возможность фильтровать транзакции по количеству.
- **Автоматические уведомления**: Подписка на автоматические уведомления о новых транзакциях.

## Технологии

- Node.js
- Telegraf
- Axios
- PostgreSQL
- dotenv для управления конфигурациями

## Начало работы

### Установка

1. Клонируйте репозиторий:
    ```bash
    git clone https://github.com/yourusername/tronBot.git
    cd tronBot
    ```

2. Установите зависимости:
    ```bash
    npm install
    ```

3. Создайте файл `.env` в корневом каталоге проекта и укажите необходимые переменные окружения:
    ```plaintext
    TELEGRAM_TOKEN=your_telegram_bot_token
    POSTGRESQL_USER=your_postgresql_user
    POSTGRESQL_HOST=your_postgresql_host
    POSTGRESQL_DBNAME=your_database_name
    POSTGRESQL_PASSWORD=your_password
    POSTGRESQL_PORT=your_port
    ```

### Запуск

Запустите бота с помощью команды:
```bash
npm run start
