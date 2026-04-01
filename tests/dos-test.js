import http from "k6/http";
import { sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 200 }, // sobe para 200 usuários
    { duration: "30s", target: 500 }, // sobe para 500
    { duration: "30s", target: 1000 }, // pico de ataque
    { duration: "30s", target: 0 }, // encerra
  ],
};

export default function () {
  http.get("http://localhost:3000/public");
  sleep(1);
}
