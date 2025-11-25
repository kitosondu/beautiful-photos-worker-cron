# Это воркер на Cloudflare для чистки БД

Информацию о БД см. в репозитории Beautiful Photos Worker

## Разработка

`npm run dev` &mdash; запуск локального сервера для разработки

### Миграции БД

__Локальная разработка:__

```bash
# Применить обе миграции по порядку
./node_modules/.bin/wrangler d1 execute unsplash_photos --local --file=./src/migrations/20241125000000_init.sql
./node_modules/.bin/wrangler d1 execute unsplash_photos --local --file=./src/migrations/20241125010000_photo_classifications.sql
```

__Production:__

```bash
./node_modules/.bin/wrangler d1 execute unsplash_photos --file=./src/migrations/20241125010000_photo_classifications.sql
```

## Развертывание

**Добавить секреты и переменные окружения**

Список переменных см. в `.dev.vars.example`. Добавлять необходимо через командную строку, например

```
npx wrangler secret put UNSPLASH_CLIENT_ID
```

потому что если добавить через веб-интерфейс, при развертывании через скрипт они будут затерты.

**Развертывание**

```
npm run deploy
```
