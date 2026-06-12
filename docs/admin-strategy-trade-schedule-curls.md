# Admin Strategy Trade Schedule API Curls

Base URL:

```bash
export BASE_URL="https://backend.tradebro.io"
export ADMIN_JWT="YOUR_ADMIN_ACCESS_TOKEN"
```

Purpose:

- These admin-only APIs control time-based blocking for strategy trades sent from the admin strategy flow.
- During blocked windows, alert snapshots are still stored, but signal fanout and trade execution are skipped.

Day mapping:

- `0` = Sunday
- `1` = Monday
- `2` = Tuesday
- `3` = Wednesday
- `4` = Thursday
- `5` = Friday
- `6` = Saturday

Time rules:

- `timezone` must be a valid IANA timezone, for example `Asia/Kolkata`
- `startTime` and `endTime` must use `HH:mm`
- Overnight windows are supported, for example `23:00` to `01:30`

## 1. Get Current Admin Strategy Trade Schedule

Endpoint:

```text
GET /user/admin/strategy-trade-schedule
```

cURL:

```bash
curl --request GET "$BASE_URL/user/admin/strategy-trade-schedule" \
  --header "Authorization: Bearer $ADMIN_JWT" \
  --header "Accept: application/json"
```

Example response:

```json
{
  "message": "Admin strategy trade schedule fetched",
  "data": {
    "isEnabled": true,
    "timezone": "Asia/Kolkata",
    "windows": [
      {
        "id": "evening_block",
        "label": "Evening pause",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "17:00",
        "endTime": "19:00",
        "isEnabled": true
      }
    ],
    "updatedAt": "2026-04-21T10:00:00.000Z"
  }
}
```

## 2. Enable One Block Window

Use this to block strategy trades from Monday to Friday, 5:00 PM to 7:00 PM.

Endpoint:

```text
PUT /user/admin/strategy-trade-schedule
```

cURL:

```bash
curl --request PUT "$BASE_URL/user/admin/strategy-trade-schedule" \
  --header "Authorization: Bearer $ADMIN_JWT" \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --data '{
    "isEnabled": true,
    "timezone": "Asia/Kolkata",
    "windows": [
      {
        "id": "evening_block",
        "label": "Evening pause",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "17:00",
        "endTime": "19:00",
        "isEnabled": true
      }
    ]
  }'
```

## 3. Enable Multiple Flexible Windows

This example adds:

- a morning block
- an evening block
- an overnight block

cURL:

```bash
curl --request PUT "$BASE_URL/user/admin/strategy-trade-schedule" \
  --header "Authorization: Bearer $ADMIN_JWT" \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --data '{
    "isEnabled": true,
    "timezone": "Asia/Kolkata",
    "windows": [
      {
        "id": "morning_block",
        "label": "Morning no-trade",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "09:00",
        "endTime": "09:30",
        "isEnabled": true
      },
      {
        "id": "evening_block",
        "label": "Evening pause",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "17:00",
        "endTime": "19:00",
        "isEnabled": true
      },
      {
        "id": "overnight_block",
        "label": "Overnight block",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "23:00",
        "endTime": "01:30",
        "isEnabled": true
      }
    ]
  }'
```

## 4. Keep Schedule Enabled But Disable One Window

This keeps the schedule feature on, but turns off the morning block.

cURL:

```bash
curl --request PUT "$BASE_URL/user/admin/strategy-trade-schedule" \
  --header "Authorization: Bearer $ADMIN_JWT" \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --data '{
    "isEnabled": true,
    "timezone": "Asia/Kolkata",
    "windows": [
      {
        "id": "morning_block",
        "label": "Morning no-trade",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "09:00",
        "endTime": "09:30",
        "isEnabled": false
      },
      {
        "id": "evening_block",
        "label": "Evening pause",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "17:00",
        "endTime": "19:00",
        "isEnabled": true
      }
    ]
  }'
```

## 5. Disable Entire Schedule

Use this to completely turn off all admin strategy time blocking.

cURL:

```bash
curl --request PUT "$BASE_URL/user/admin/strategy-trade-schedule" \
  --header "Authorization: Bearer $ADMIN_JWT" \
  --header "Content-Type: application/json" \
  --header "Accept: application/json" \
  --data '{
    "isEnabled": false,
    "timezone": "Asia/Kolkata",
    "windows": []
  }'
```

Example update response:

```json
{
  "message": "Admin strategy trade schedule updated",
  "data": {
    "isEnabled": true,
    "timezone": "Asia/Kolkata",
    "windows": [
      {
        "id": "evening_block",
        "label": "Evening pause",
        "daysOfWeek": [1, 2, 3, 4, 5],
        "startTime": "17:00",
        "endTime": "19:00",
        "isEnabled": true
      }
    ],
    "updatedAt": "2026-04-21T11:30:00.000Z"
  }
}
```

## Validation Notes

- `isEnabled` must be boolean
- `timezone` must be a valid IANA timezone
- `windows` must be an array
- each window must have:
  - `daysOfWeek`
  - `startTime`
  - `endTime`
  - `isEnabled`
- `id` values should be unique across windows
