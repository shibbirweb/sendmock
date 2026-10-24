import {
  AnimatedSpan,
  Terminal,
  TypingAnimation,
} from "@/components/ui/terminal";

/** Shows the intended first run; commands go live with the first beta. */
export function QuickStartSection() {
  return (
    <section className="flex flex-col items-center gap-6 px-4 py-16">
      <h2 className="text-2xl font-semibold">From install to first OTP</h2>
      <Terminal className="max-w-2xl">
        <TypingAnimation>$ brew install mss</TypingAnimation>
        <AnimatedSpan className="text-green-500">
          ✔ Installed mss (one 12 MB binary)
        </AnimatedSpan>
        <TypingAnimation>$ mss</TypingAnimation>
        <AnimatedSpan>SMTP listening on 127.0.0.1:1025</AnimatedSpan>
        <AnimatedSpan>Web UI and API on http://127.0.0.1:8025</AnimatedSpan>
        <TypingAnimation>$ mss otp --to +8801700000000 --wait 10s</TypingAnimation>
        <AnimatedSpan className="text-green-500">482913</AnimatedSpan>
      </Terminal>
    </section>
  );
}
