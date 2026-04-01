import http from "k6/http";
import { check, sleep } from "k6";

// carga para testes de carga
/*export const options = {
  stages: [
    { duration: "30s", target: 50 }, // sobe para 50 usuários
    { duration: "1m", target: 200 }, // sobe para 200 usuários
    { duration: "2m", target: 500 }, // pico de carga
    { duration: "30s", target: 0 }, // reduz
  ],
};*/

// carga para teste Chaos engineering
export const options = {
  vus: 100,
  duration: "2m",
};

export default function () {
  const res = http.get("http://localhost:3000/public");

  check(res, {
    "status 200": (r) => r.status === 200,
    "response time < 500ms": (r) => r.timings.duration < 500,
  });

  sleep(1);
}
