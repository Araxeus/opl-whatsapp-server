# opl-whatsapp-server

The package manager for this project is [bun](https://bun.sh)

## Dev mode

Install deps:

```bash
bun install
```

start the server on localhost using `.env` file:

```bash
bun start
```

## Production

Build using:

```bash
bun install --production --frozen-lockfile && bun _build
```

Run using:

```bash
node ./dist/server.js
```

 To disable testing mode set the environment variable `TEST_MODE` to `off` aka:

Bash:

```bash
export TEST_MODE=off
```

Dockerfile:

```dockerfile
ENV TEST_MODE=off
```

Powershell:

```powershell
$env:TEST_MODE = "off"
```

CMD:

```cmd
set TEST_MODE=off
```

## Requirements

- Node.js latest
- Bun latest
- The following environment variables are required:
  - `MONGODB_URI` - The URI for the MongoDB database
  - `USERID_SECRET` - The secret for the user tokens
  - `OPERATE_PHONE_NUMBER` - Phone number of the service the server interacts with
  - `OPENAI_API_KEY` - The API key for OpenAI
  - `REFRESH_KEY` - The key for accepted for API calls to refresh active user sessions
- The following environment variables are optional:
  - `TEST_USERID` - [Optional] The user ID for testing
  - `TEST_MODE` - set to `off` to disable testing mode
  - `PORT` - [Optional] The port the server listens on
  - `HOST` - [Optional] The host the server listens on
