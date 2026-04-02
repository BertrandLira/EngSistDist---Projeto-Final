import http from "k6/http";
import { check, sleep } from "k6";

// carga para testes de carga
export const options = {
  stages: [
    { duration: "30s", target: 100 }, // sobe para 50 usuários
    { duration: "30s", target: 500 }, // sobe para 200 usuários
    { duration: "30s", target: 10000 }, // pico de carga
    { duration: "30s", target: 0 }, // reduz
  ],
};

const videoIds = [
  "f1aa0385-bd31-4c8f-8029-3ef328d7ca33",
  "2aac43cf-6619-4e27-be13-93253b325aa6",
  "cf38723f-6f01-4374-be95-2f085ed22642",
];

export default function () {
  const videoId = videoIds[Math.floor(Math.random() * videoIds.length)];
  const url = `http://127.0.0.1:4000/videos/${videoId}/challenges`;

  const res = http.post(url, null, {
    headers: {
      "Content-Type": "application/json",
    },
  });

  let body;

  try {
    body = JSON.parse(res.body);
  } catch (e) {
    body = {};
  }

  check(res, {
    "status ok": (r) => r.status === 200 || r.status === 201,
    "response time < 500ms": (r) => r.timings.duration < 5000,
  });

  sleep(1);
}
