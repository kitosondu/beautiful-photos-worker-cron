# Unsplash for Chrome &mdash; Worker для работы с Unsplash API

## Как работает

Чтобы работать с этим воркером, нужно получить токен доступа через `/api/token`. Он действует 10 минут. После этого можно запросить фото с Unsplash через `/api/photos/random?token=<token>`.

## Разработка

Создать файл `.dev.vars` в корне проекта с переменными окружения. Такие же переменные и/или секреты должны быть созданы в настройках Workers в Cloudflare (см раздел "Развертывание").


`npm run dev` &mdash; запуск локального сервера для разработки

При этом необходимо создать файл `.dev.vars` в корне проекта с переменными окружения. Такие же переменные и/или секреты должны быть созданы в настройках Workers в Cloudflare.


```
./node_modules/.bin/wrangler d1 execute unsplash_photos \
  --local --command "CREATE TABLE "photos" ("photo_id" varchar PRIMARY KEY NOT NULL, "data_json" text NOT NULL, "created_ts" integer NOT NULL);"

./node_modules/.bin/wrangler d1 execute unsplash_photos \
  --local --command "CREATE TABLE "access_tokens" ( "token" varchar PRIMARY KEY NOT NULL, "created_ts" integer NOT NULL);"
```

Other

```BASH
# DROP photos
./node_modules/.bin/wrangler d1 execute unsplash_photos \
  --local --command "DROP table "photos";"

# DROP access_tokens
./node_modules/.bin/wrangler d1 execute unsplash_photos \
  --local --command "DROP table "access_tokens";"

# SELECT photos
./node_modules/.bin/wrangler d1 execute unsplash_photos \
  --local --command "SELECT photo_id, created_ts FROM "photos";"

# SELECT access_tokens
./node_modules/.bin/wrangler d1 execute unsplash_photos \
  --local --command "SELECT token, created_ts FROM "access_tokens";"
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
