// Local stand-in for Clerk's JWKS endpoint, used only by the API E2E suite.
// Start it, then run the backend with
//   CLERK_JWKS_URI=http://localhost:9999/.well-known/jwks.json CLERK_ISSUER=http://localhost:9999
// The backend code path is unchanged: Nimbus RS256 signature + issuer + expiry + azp checks.
import http from "node:http";
import fs from "node:fs";
import { generateKeyPairSync } from "node:crypto";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: "e2e-key", alg: "RS256", use: "sig" };
fs.mkdirSync("e2e-artifacts", { recursive: true });
fs.writeFileSync("e2e-artifacts/test-issuer-key.pem", privateKey.export({ type: "pkcs8", format: "pem" }));

http
  .createServer((req, res) => {
    if (req.url === "/.well-known/jwks.json") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ keys: [jwk] }));
    } else {
      res.writeHead(404).end();
    }
  })
  .listen(9999, () => console.log("test issuer on http://localhost:9999"));
