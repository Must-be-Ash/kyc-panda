"use client";

import { useEffect, useRef } from "react";
import { ShimmerButton } from "@/components/ui/shimmer-button";
import { GooeyFilter } from "@/components/ui/gooey-filter";
import { PixelTrail } from "@/components/ui/pixel-trail";
import { useScreenSize } from "@/hooks/use-screen-size";

export default function Home() {
  const screenSize = useScreenSize();
  const trailContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = trailContainerRef.current;
    if (!container) return;

    const pixelSize = screenSize.lessThan("md") ? 24 : 32;
    const animationFrameIds: number[] = [];

    const buildPixelMap = (): Map<string, HTMLElement> => {
      const pixelMap = new Map<string, HTMLElement>();
      const allPixels = document.querySelectorAll('[id*="-pixel-"]');
      allPixels.forEach((pixel) => {
        const match = pixel.id.match(/-pixel-(\d+)-(\d+)/);
        if (match) {
          pixelMap.set(`${match[1]}-${match[2]}`, pixel as HTMLElement);
        }
      });
      return pixelMap;
    };

    const pixelTrailContainer = container.querySelector(
      '[class*="absolute inset-0"]'
    ) as HTMLDivElement;
    if (!pixelTrailContainer) return;

    let pixelMap = buildPixelMap();
    let mapRebuildAttempts = 0;
    const rebuildPixelMap = () => {
      if (pixelMap.size === 0 && mapRebuildAttempts < 10) {
        mapRebuildAttempts++;
        pixelMap = buildPixelMap();
        if (pixelMap.size === 0) setTimeout(rebuildPixelMap, 100);
      }
    };
    setTimeout(rebuildPixelMap, 300);

    const createTrailAnimation = (startX: number, startY: number) => {
      let currentX = startX;
      let currentY = startY;
      let velocityX = (Math.random() - 0.5) * 2;
      let velocityY = (Math.random() - 0.5) * 2;
      const speed = 1.5;
      let angle = Math.random() * Math.PI * 2;
      let angleVelocity = (Math.random() - 0.5) * 0.05;
      let circleRadius = 0;
      let circleCenterX = currentX;
      let circleCenterY = currentY;
      let movementMode: "scribble" | "circle" =
        Math.random() > 0.3 ? "scribble" : "circle";
      let modeChangeCounter = 0;

      const animateMovement = () => {
        modeChangeCounter++;
        if (modeChangeCounter > 120 && Math.random() > 0.98) {
          movementMode = Math.random() > 0.3 ? "scribble" : "circle";
          modeChangeCounter = 0;
          if (movementMode === "circle") {
            circleCenterX = currentX;
            circleCenterY = currentY;
            circleRadius = 50 + Math.random() * 100;
            angleVelocity = (Math.random() - 0.5) * 0.08;
          } else {
            velocityX = (Math.random() - 0.5) * 2;
            velocityY = (Math.random() - 0.5) * 2;
          }
        }

        if (movementMode === "circle") {
          angle += angleVelocity;
          currentX = circleCenterX + Math.cos(angle) * circleRadius;
          currentY = circleCenterY + Math.sin(angle) * circleRadius;
          if (Math.random() > 0.95) {
            angleVelocity += (Math.random() - 0.5) * 0.02;
            angleVelocity = Math.max(-0.1, Math.min(0.1, angleVelocity));
          }
        } else {
          velocityX += (Math.random() - 0.5) * 0.3;
          velocityY += (Math.random() - 0.5) * 0.3;
          velocityX *= 0.98;
          velocityY *= 0.98;
          const maxVel = 3;
          velocityX = Math.max(-maxVel, Math.min(maxVel, velocityX));
          velocityY = Math.max(-maxVel, Math.min(maxVel, velocityY));
          currentX += velocityX * speed;
          currentY += velocityY * speed;
          if (currentX < 0 || currentX > window.innerWidth) {
            velocityX *= -0.8;
            currentX = Math.max(0, Math.min(window.innerWidth, currentX));
          }
          if (currentY < 0 || currentY > window.innerHeight) {
            velocityY *= -0.8;
            currentY = Math.max(0, Math.min(window.innerHeight, currentY));
          }
        }

        if (pixelMap.size === 0) pixelMap = buildPixelMap();
        const rect = pixelTrailContainer.getBoundingClientRect();
        const x = Math.floor((currentX - rect.left) / pixelSize);
        const y = Math.floor((currentY - rect.top) / pixelSize);
        const pixel = pixelMap.get(`${x}-${y}`);
        if (pixel) {
          const animatePixel = (
            pixel as unknown as { __animatePixel?: () => void }
          ).__animatePixel;
          if (animatePixel) animatePixel();
        }

        const frameId = requestAnimationFrame(animateMovement);
        animationFrameIds.push(frameId);
      };

      const frameId = requestAnimationFrame(animateMovement);
      animationFrameIds.push(frameId);
    };

    const positions = [
      [0.5, 0.5],
      [0.25, 0.3],
      [0.75, 0.7],
      [0.15, 0.7],
      [0.85, 0.25],
      [0.5, 0.15],
      [0.1, 0.5],
      [0.9, 0.5],
    ];
    positions.forEach(([px, py]) =>
      createTrailAnimation(window.innerWidth * px, window.innerHeight * py)
    );

    return () => animationFrameIds.forEach((id) => cancelAnimationFrame(id));
  }, [screenSize]);

  return (
    <main
      className="min-h-screen flex flex-col items-center justify-center px-6 py-24 md:py-32 relative overflow-hidden"
      style={{ backgroundColor: "#0a0a0a" }}
    >
      {/* Gooey pixel trail background */}
      <GooeyFilter id="gooey-filter-pixel-trail" strength={8} />
      <div
        ref={trailContainerRef}
        className="absolute inset-0 z-0"
        style={{ filter: "url(#gooey-filter-pixel-trail)" }}
      >
        <PixelTrail
          pixelSize={screenSize.lessThan("md") ? 24 : 32}
          fadeDuration={0}
          delay={800}
          pixelClassName={
            screenSize.lessThan("md") ? "bg-[#1a1a1a]" : "bg-[#141414]"
          }
        />
      </div>

      <div className="max-w-2xl w-full relative z-10 flex flex-col items-center gap-20">
        {/* Hero */}
        <div className="text-center flex flex-col items-center gap-6">
          <h1
            className="font-jersey text-6xl md:text-8xl tracking-tight"
            style={{ color: "#fafafa" }}
          >
            KYC Panda
          </h1>
          <p
            className="text-lg md:text-xl leading-relaxed max-w-lg"
            style={{ color: "#888888" }}
          >
            KYC gate extension for x402 endpoints.
            <br />
            Verify once with your wallet, transact anywhere.
          </p>

          {/* Feature badges */}
          <div
            className="flex flex-wrap justify-center gap-6 text-sm mt-2"
            style={{ color: "#666666" }}
          >
            {[
              "SIWX / CAIP-122 compliant",
              "Verify once, use everywhere",
              "No PII stored",
            ].map((feature) => (
              <div key={feature} className="flex items-center gap-2">
                <span style={{ color: "#22c55e" }}>&#10003;</span>
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* How It Works */}
        <section className="w-full flex flex-col gap-6">
          <h2
            className="font-jersey text-3xl md:text-4xl"
            style={{ color: "#fafafa" }}
          >
            How it works
          </h2>
          <div className="flex flex-col gap-4">
            {[
              "Agent hits a KYC-gated x402 endpoint",
              "Gets 402 with sign-in-with-x challenge + kyc-gate extension",
              "Agent signs the SIWX challenge with its wallet",
              "Server verifies signature, checks KYC status",
              "If KYC approved \u2192 access granted. If not \u2192 onboarding URL returned",
            ].map((text, i) => (
              <div key={i} className="flex items-start gap-4">
                <span
                  className="text-sm font-mono w-7 h-7 rounded flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#1f1f1f", color: "#888888" }}
                >
                  {i + 1}
                </span>
                <p
                  className="text-sm leading-relaxed pt-1"
                  style={{ color: "#888888" }}
                >
                  {text}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Divider */}
        <div
          className="w-full h-px"
          style={{ backgroundColor: "#2a2a2a" }}
        />

        {/* Links */}
        <div className="flex flex-col items-center gap-10">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <ShimmerButton
              href="/docs"
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
                  <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
                </svg>
              }
            >
              Docs
            </ShimmerButton>
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

          {/* Footer */}
          <div
            className="flex items-center justify-center gap-4 text-xs"
            style={{ color: "#444444" }}
          >
            <a
              href="https://x402.org"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              Built on x402
            </a>
            <span>&middot;</span>
            <a
              href="https://didit.me"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              KYC by Didit
            </a>
            <span>&middot;</span>
            <a
              href="https://github.com/ChainAgnostic/CAIPs/blob/main/CAIPs/caip-122.md"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:opacity-80 transition-opacity"
            >
              SIWX per CAIP-122
            </a>
          </div>
        </div>
      </div>
    </main>
  );
}
