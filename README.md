# Obliq Administration (Next.js)

Вътрешна административна система (CMS + CRM + медицински workflow) за естетичен медицински център Obliq, реализирана с Next.js.

## Стартиране

```bash
cd /Users/nedaveleva/Documents/projects/obliq/admin/administration
npm install
npm run dev
```

Отвори [http://localhost:3000](http://localhost:3000).

## Основни модули

- Dashboard с минималистични дневни метрики и quick actions
- Клиентски досиета: обобщение, Skin Profile, история, бележки
- Календар: day/week, drag & drop, филтри по специалист и статус
- Booking правило: нов клиент може да запише само консултация
- Двупосочен модул Проблеми ↔ Процедури (multi-select връзки)
- Премиум ценоразпис по услуга/резултат (без количества)
- CMS редактор за ключови страници

## Структура

- `app/layout.js` - root layout и шрифтове
- `app/page.js` - основната административна логика и UI
- `app/globals.css` - стилова система и responsive поведение

## Данни

Данните се пазят в `localStorage` (`obliq-administration-v1`) за бърз internal prototyping без бекенд.
