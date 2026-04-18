import app from "./app";
import { config } from "./config/env";

app.listen(config.port, () => {
  console.log(`NTS API running on http://localhost:${config.port}`);
});
