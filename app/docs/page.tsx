"use client";

import { useState } from "react";
import Link from "next/link";
import { ShimmerButton } from "@/components/ui/shimmer-button";

function CopyIcon({ copied }: { copied: boolean }) {
  if (copied) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#22c55e"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <polyline points="20 6 9 17 4 12" />
      </svg>
    );
  }
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#888888"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

function CodeBlock({
  code,
  label,
  copiedId,
  onCopy,
}: {
  code: string;
  label?: string;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
}) {
  const id = code;
  return (
    <div>
      {label && (
        <p className="text-xs mb-2" style={{ color: "#666666" }}>
          {label}
        </p>
      )}
      <div
        className="flex items-center justify-between rounded-lg px-4 py-3 cursor-pointer hover:opacity-90 transition-opacity"
        style={{ backgroundColor: "#141414" }}
        onClick={() => onCopy(id, code)}
      >
        <code
          className="text-sm font-mono flex-1 min-w-0 overflow-x-auto whitespace-pre"
          style={{ color: "#fafafa" }}
        >
          {code}
        </code>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onCopy(id, code);
          }}
          className="p-1.5 rounded transition-all duration-200 hover:scale-110 flex-shrink-0 ml-3 cursor-pointer"
          style={{ backgroundColor: "#2a2a2a" }}
          aria-label="Copy to clipboard"
        >
          <CopyIcon copied={copiedId === id} />
        </button>
      </div>
    </div>
  );
}

function MultiLineCodeBlock({
  code,
  copiedId,
  onCopy,
  label,
}: {
  code: string;
  copiedId: string | null;
  onCopy: (id: string, text: string) => void;
  label?: string;
}) {
  const id = code;
  return (
    <div>
      {label && (
        <p className="text-xs mb-2" style={{ color: "#666666" }}>
          {label}
        </p>
      )}
      <div
        className="relative rounded-lg px-5 py-4"
        style={{ backgroundColor: "#141414" }}
      >
        <button
          onClick={() => onCopy(id, code)}
          className="absolute top-3 right-3 p-1.5 rounded transition-all duration-200 hover:scale-110 cursor-pointer"
          style={{ backgroundColor: "#2a2a2a" }}
          aria-label="Copy to clipboard"
        >
          <CopyIcon copied={copiedId === id} />
        </button>
        <pre className="text-sm font-mono overflow-x-auto whitespace-pre pr-10">
          <code style={{ color: "#fafafa" }}>{code}</code>
        </pre>
      </div>
    </div>
  );
}

export default function Docs() {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyToClipboard = async (id: string, text: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <main
      className="min-h-screen flex flex-col items-center px-6 py-16 md:py-24"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      <div className="max-w-2xl w-full flex flex-col gap-20">
        {/* Header */}
        <div className="flex flex-col gap-4">
          <Link
            href="/"
            className="text-sm flex items-center gap-2 hover:opacity-80 transition-opacity w-fit"
            style={{ color: "#666666" }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m15 18-6-6 6-6" />
            </svg>
            Back
          </Link>
          <h1
            className="font-jersey text-4xl md:text-5xl"
            style={{ color: "#fafafa" }}
          >
            Documentation
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: "#666666" }}>
            Integration guide for sellers (x402 servers) and buyers (x402
            clients).
          </p>
        </div>

        {/* For Sellers */}
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2
              className="font-jersey text-3xl md:text-4xl"
              style={{ color: "#fafafa" }}
            >
              For sellers
            </h2>
            <p className="text-sm" style={{ color: "#666666" }}>
              Add KYC requirements to your x402 endpoints
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium" style={{ color: "#888888" }}>
              1. Declare the extension in your 402 response
            </p>
            <MultiLineCodeBlock
              label="Adds sign-in-with-x challenge + kyc-gate metadata to 402 responses"
              code={`import { declareKYCGateExtension } from "./lib/bouncer";

const extensions = declareKYCGateExtension({
  domain: "api.yourservice.com",
  uri: "https://api.yourservice.com/premium-data",
});

// Add to your 402 response:
// { x402Version: "2", accepts: [...], extensions }`}
              copiedId={copiedId}
              onCopy={copyToClipboard}
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium" style={{ color: "#888888" }}>
              2. Verify SIWX + KYC on incoming requests
            </p>
            <MultiLineCodeBlock
              label="Verifies SIWX signature, checks KYC status via verify endpoint"
              code={`import { createKYCGateHook } from "./lib/bouncer";

const kycGate = createKYCGateHook();

async function handleRequest(request: Request) {
  const result = await kycGate(request);

  if (result.grantAccess) {
    return new Response(JSON.stringify({ data: "premium" }));
  }

  // Not verified — return 402 with extensions
  return new Response(JSON.stringify({
    error: result.reason,
    onboardingUrl: result.onboardingUrl,
  }), { status: 402 });
}`}
              copiedId={copiedId}
              onCopy={copyToClipboard}
            />
          </div>
        </section>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "#2a2a2a" }} />

        {/* For Buyers */}
        <section className="flex flex-col gap-8">
          <div className="flex flex-col gap-2">
            <h2
              className="font-jersey text-3xl md:text-4xl"
              style={{ color: "#fafafa" }}
            >
              For buyers
            </h2>
            <p className="text-sm" style={{ color: "#666666" }}>
              Check your KYC status or onboard
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium" style={{ color: "#888888" }}>
              Check if your wallet is verified
            </p>
            <CodeBlock
              label="GET"
              code="curl https://kyc-panda.vercel.app/api/verify/0xYourAddress"
              copiedId={copiedId}
              onCopy={copyToClipboard}
            />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium" style={{ color: "#888888" }}>
              Start KYC onboarding
            </p>
            <MultiLineCodeBlock
              label="Sign a SIWE message and submit to begin verification"
              code={`import { SiweMessage } from "siwe";
import { privateKeyToAccount } from "viem/accounts";
import crypto from "crypto";

const account = privateKeyToAccount(process.env.KEY as \`0x\${string}\`);

const siweMessage = new SiweMessage({
  domain: "kyc-panda.vercel.app",
  address: account.address,
  uri: "https://kyc-panda.vercel.app/api/onboard",
  version: "1",
  chainId: 8453,
  nonce: crypto.randomBytes(16).toString("hex"),
  issuedAt: new Date().toISOString(),
  statement: "Sign in to verify KYC status",
});

const msg = siweMessage.prepareMessage();
const signature = await account.signMessage({ message: msg });

const res = await fetch("https://kyc-panda.vercel.app/api/onboard", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ siwxMessage: msg, signature }),
});

const { verificationUrl } = await res.json();
// Human opens verificationUrl to complete KYC`}
              copiedId={copiedId}
              onCopy={copyToClipboard}
            />
          </div>
        </section>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "#2a2a2a" }} />

        {/* 402 Response Shape */}
        <section className="flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <h2
              className="font-jersey text-3xl md:text-4xl"
              style={{ color: "#fafafa" }}
            >
              402 response shape
            </h2>
            <p className="text-sm" style={{ color: "#666666" }}>
              What agents see in a KYC-gated 402 response
            </p>
          </div>

          <MultiLineCodeBlock
            code={`{
  "x402Version": "2",
  "accepts": [{ "scheme": "exact", "network": "eip155:8453", ... }],
  "extensions": {
    "sign-in-with-x": {
      "info": {
        "domain": "api.yourservice.com",
        "uri": "https://api.yourservice.com/data",
        "version": "1",
        "nonce": "a1b2c3d4e5f67890a1b2c3d4e5f67890",
        "issuedAt": "2026-03-10T10:30:00.000Z",
        "expirationTime": "2026-03-10T10:35:00.000Z",
        "statement": "Sign in to verify KYC status"
      },
      "supportedChains": [
        { "chainId": "eip155:8453", "type": "eip191" }
      ],
      "schema": { ... }
    },
    "kyc-gate": {
      "required": true,
      "onboardingUrl": "https://kyc-panda.vercel.app/api/onboard",
      "provider": "didit"
    }
  }
}`}
            copiedId={copiedId}
            onCopy={copyToClipboard}
          />
        </section>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "#2a2a2a" }} />

        {/* Status Codes */}
        <section className="flex flex-col gap-6">
          <h2
            className="font-jersey text-3xl md:text-4xl"
            style={{ color: "#fafafa" }}
          >
            Status codes
          </h2>

          <div
            className="rounded-lg overflow-hidden text-sm"
            style={{ backgroundColor: "#141414" }}
          >
            {[
              ["KYC_NOT_FOUND", "Wallet has never completed KYC"],
              ["KYC_EXPIRED", "KYC approved but expired (>1 year)"],
              ["KYC_DECLINED", "KYC was rejected"],
              ["KYC_PENDING_REVIEW", "Under manual review"],
              ["INVALID_SIGNATURE", "SIWX signature verification failed"],
              ["NONCE_REUSED", "Replay attack detected"],
            ].map(([code, desc], i) => (
              <div
                key={code}
                className="flex items-start px-5 py-3.5"
                style={{
                  borderBottom: i < 5 ? "1px solid #2a2a2a" : "none",
                }}
              >
                <code
                  className="font-mono text-xs w-48 flex-shrink-0"
                  style={{ color: "#fafafa" }}
                >
                  {code}
                </code>
                <span style={{ color: "#666666" }}>{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "#2a2a2a" }} />

        {/* API Endpoints */}
        <section className="flex flex-col gap-6">
          <h2
            className="font-jersey text-3xl md:text-4xl"
            style={{ color: "#fafafa" }}
          >
            API endpoints
          </h2>

          <div
            className="rounded-lg overflow-hidden text-sm"
            style={{ backgroundColor: "#141414" }}
          >
            {[
              ["GET", "/api/verify/{address}", "Check KYC status"],
              ["POST", "/api/onboard", "Start KYC onboarding"],
              ["GET", "/api/health", "Service health check"],
            ].map(([method, path, desc], i) => (
              <div
                key={path}
                className="flex items-start px-5 py-3.5"
                style={{
                  borderBottom: i < 2 ? "1px solid #2a2a2a" : "none",
                }}
              >
                <code
                  className="font-mono text-xs w-14 flex-shrink-0"
                  style={{ color: "#22c55e" }}
                >
                  {method}
                </code>
                <code
                  className="font-mono text-xs w-52 flex-shrink-0"
                  style={{ color: "#fafafa" }}
                >
                  {path}
                </code>
                <span style={{ color: "#666666" }}>{desc}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div className="h-px" style={{ backgroundColor: "#2a2a2a" }} />

        {/* Bottom links */}
        <div className="flex items-center justify-center gap-4 flex-wrap pb-4">
          <ShimmerButton
            href="https://github.com/coinbase/x402/blob/main/specs/extensions/sign-in-with-x.md"
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
          >
            SIWX Spec
          </ShimmerButton>
          <ShimmerButton
            href="/openapi.json"
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              </svg>
            }
          >
            OpenAPI
          </ShimmerButton>
          <ShimmerButton
            href="/skill.md"
            icon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="m16 12-4-4-4 4M12 16V8" />
              </svg>
            }
          >
            Skill Guide
          </ShimmerButton>
        </div>
      </div>
    </main>
  );
}
