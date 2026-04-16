import { env } from "./config/env.js";
import app from "./app.js";

app.listen(env.port, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on http://localhost:${env.port}`);
});
