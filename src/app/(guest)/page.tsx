"use client";
/**
 * HomePage (Landing Page)
 *
 * @param {Object} props - Component props (not used)
 *
 * @returns {JSX.Element}
 * Renders the main entry page and controls user onboarding flow.
 *
 * This component manages the initial user journey in the application.
 * It connects with the Solana wallet and authentication system.
 * If the wallet is not connected, the user is prompted to connect.
 * Once connected, the user is asked to sign a message for authentication.
 * After authentication, the system checks if the user belongs to any team.
 * If the user has an existing team, they are redirected to the dashboard.
 * If no team exists, the user is guided to create a new team wallet.
 * It also prevents duplicate login attempts using internal state.
 * Overall, it acts as the controller for routing and access decisions.
 */
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useAuth } from "@/src/providers/AuthProvider";
import { useTeamAccess } from "@/src/hooks/useApi";
import { motion, useInView, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Code2,
  Coins,
  Globe,
  Lock,
  Repeat,
  Shield,
  ShieldCheck,
  Sparkles,
  Users,
  Vote,
  Wallet,
  Zap,
  ArrowUpDown,
  Eye,
  FileCode,
  Image as ImageIcon,
} from "lucide-react";
import { useTranslations } from "next-intl";

function NetworkCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    const particles: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      glow: boolean;
    }[] = [];

    const resize = () => {
      canvas.width = canvas.offsetWidth * 2;
      canvas.height = canvas.offsetHeight * 2;
    };
    resize();
    window.addEventListener("resize", resize);

    const COUNT = 60;
    const MAX_DIST = 180;

    for (let i = 0; i < COUNT; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.6,
        vy: (Math.random() - 0.5) * 0.6,
        r: Math.random() * 2 + 1,
        glow: Math.random() > 0.7,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < MAX_DIST) {
            const alpha = (1 - dist / MAX_DIST) * 0.15;
            ctx.strokeStyle = `rgba(1, 56, 112, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;

        if (p.glow) {
          ctx.shadowBlur = 12;
          ctx.shadowColor = "rgba(35, 170, 155, 0.6)";
        }
        ctx.fillStyle = p.glow ? "rgba(35, 170, 155, 0.8)" : "rgba(1, 56, 112, 0.3)";
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none absolute inset-0 h-full w-full opacity-60"
    />
  );
}

function AnimatedCounter({
  target,
  suffix = "",
  prefix = "",
  duration = 2000,
  className = "",
}: {
  target: number;
  suffix?: string;
  prefix?: string;
  duration?: number;
  className?: string;
}) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, target, duration]);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

const PROPOSAL_STAGES = [
  {
    label: "Proposal Created",
    icon: Sparkles,
    color: "text-info",
    bg: "bg-info/10",
    border: "border-info/30",
    detail: "Transfer 5.2 SOL to marketing",
  },
  {
    label: "Voting",
    icon: Vote,
    color: "text-warning",
    bg: "bg-warning/10",
    border: "border-warning/30",
    detail: "2 of 3 signatures collected",
  },
  {
    label: "Approved",
    icon: ShieldCheck,
    color: "text-success",
    bg: "bg-success/10",
    border: "border-success/30",
    detail: "Threshold reached — ready to execute",
  },
  {
    label: "Executed",
    icon: Zap,
    color: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    detail: "Transaction confirmed on Solana",
  },
];

function ProposalFlowDemo() {
  const [activeStage, setActiveStage] = useState(0);
  const t = useTranslations("create");
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });

  useEffect(() => {
    if (!inView) return;
    const timer = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % PROPOSAL_STAGES.length);
    }, 2500);
    return () => clearInterval(timer);
  }, [inView]);

  const signers = [
    { name: "alice.sol", signed: activeStage >= 1 },
    { name: "bob.sol", signed: activeStage >= 1 },
    { name: "carol.sol", signed: activeStage >= 2 },
  ];

  return (
    <div ref={ref} className="mx-auto w-full max-w-3xl">
      <div className="mb-8 flex items-center justify-between">
        {PROPOSAL_STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isActive = i === activeStage;
          const isPast = i < activeStage;
          return (
            <div key={stage.label} className="flex flex-1 items-center">
              <motion.div
                animate={{ scale: isActive ? 1.15 : 1 }}
                className="flex flex-col items-center gap-2"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border-2 transition-all duration-500 ${
                    isActive
                      ? `${stage.bg} ${stage.border} ${stage.color} shadow-lg`
                      : isPast
                        ? "border-success/30 bg-success/10 text-success"
                        : "border-base-300 bg-base-200 text-neutral-content"
                  }`}
                >
                  {isPast ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                </div>
                <span
                  className={`text-center text-xs font-semibold transition-colors ${
                    isActive ? stage.color : isPast ? "text-success" : "text-neutral-content"
                  }`}
                >
                  {stage.label}
                </span>
              </motion.div>
              {i < PROPOSAL_STAGES.length - 1 && (
                <div className="mx-2 mb-6 h-0.5 flex-1">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isPast ? "bg-success" : "bg-base-300"
                    }`}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>

      <motion.div layout className="glass-card overflow-hidden p-6">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStage}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-neutral-content text-xs font-medium">{t("Proposal42")}</p>
                <p className="text-base font-bold">{PROPOSAL_STAGES[activeStage].detail}</p>
              </div>
              <div
                className={`rounded-xl px-3 py-1.5 text-xs font-bold ${PROPOSAL_STAGES[activeStage].bg} ${PROPOSAL_STAGES[activeStage].color}`}
              >
                {PROPOSAL_STAGES[activeStage].label}
              </div>
            </div>

            <div className="flex gap-3 max-sm:flex-col">
              {signers.map((s, i) => (
                <motion.div
                  key={s.name}
                  initial={{ scale: 0.9 }}
                  animate={{ scale: 1 }}
                  className={`flex flex-1 items-center gap-2 rounded-xl border p-3 transition-all duration-500 ${
                    s.signed ? "border-success/30 bg-success/5" : "border-base-200 bg-base-100"
                  }`}
                >
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${
                      s.signed
                        ? "bg-success text-success-content"
                        : "bg-base-200 text-neutral-content"
                    }`}
                  >
                    {s.signed ? <Check className="h-4 w-4" /> : <span>{i + 1}</span>}
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{s.name}</p>
                    <p className="text-neutral-content text-xs">
                      {s.signed ? "Signed" : "Pending"}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>

            <div className="mt-4">
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-neutral-content">{t("Approval threshold")}</span>
                <span className="font-bold">{signers.filter((s) => s.signed).length}/3</span>
              </div>
              <div className="bg-base-200 h-2 w-full overflow-hidden rounded-full">
                <motion.div
                  className="from-primary to-success h-full rounded-full bg-linear-to-r"
                  animate={{ width: `${(signers.filter((s) => s.signed).length / 3) * 100}%` }}
                  transition={{ duration: 0.8, ease: "easeOut" }}
                />
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function getFeaturesData(t: (key: string) => string) {
  return [
    {
      id: "multisig",
      icon: ShieldCheck,
      title: "Multi-sig Wallets",
      desc: "PDA-based shared wallets with configurable approval thresholds. Every transaction needs your team's consensus.",
      highlights: ["Configurable thresholds", "On-chain PDA vaults", "Role-based access"],
      preview: (
        <div className="space-y-3">
          <div className="bg-base-200/60 flex items-center justify-between rounded-xl p-3">
            <div className="flex items-center gap-3">
              <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-xl">
                <Shield className="text-primary h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold">{t("Acme Treasury")}</p>
                <p className="text-neutral-content font-mono text-xs">8xKq...3mRv</p>
              </div>
            </div>
            <div className="bg-success/10 text-success rounded-lg px-2 py-1 text-xs font-bold">
              3 of 5
            </div>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`flex h-8 items-center justify-center rounded-lg text-xs font-bold ${
                  i <= 3 ? "bg-primary text-primary-content" : "bg-base-200 text-neutral-content"
                }`}
              >
                {i <= 3 ? <Check className="h-3 w-3" /> : i}
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "treasury",
      icon: Coins,
      title: "Treasury Management",
      desc: "Send, receive, deposit, and track tokens across your shared vault. Full balance visibility with transaction history.",
      highlights: ["SPL token support", "Deposit & withdraw", "Balance tracking"],
      preview: (
        <div className="space-y-2">
          {[
            { name: "SOL", amount: "142.5", change: "+2.4%", color: "bg-purple-500" },
            { name: "USDC", amount: "8,200", change: "+0.1%", color: "bg-blue-500" },
            { name: "BONK", amount: "5.2M", change: "+12.8%", color: "bg-orange-400" },
          ].map((token) => (
            <div
              key={token.name}
              className="bg-base-200/60 flex items-center justify-between rounded-xl p-3"
            >
              <div className="flex items-center gap-3">
                <div className={`h-8 w-8 rounded-full ${token.color}`} />
                <span className="text-sm font-bold">{token.name}</span>
              </div>
              <div className="text-right">
                <p className="text-sm font-bold">{token.amount}</p>
                <p className="text-success text-xs font-semibold">{token.change}</p>
              </div>
            </div>
          ))}
        </div>
      ),
    },
    {
      id: "swap",
      icon: Repeat,
      title: "Token Swaps",
      desc: "Swap tokens directly from your team vault via Jupiter aggregation. Best routes, multi-sig approval, one click.",
      highlights: ["Jupiter integration", "Best route finding", "Multi-sig approval"],
      preview: (
        <div className="space-y-3">
          <div className="bg-base-200/60 rounded-xl p-3">
            <p className="text-neutral-content mb-1 text-xs">{t("You send")}</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">10.0</span>
              <div className="bg-base-100 flex items-center gap-1.5 rounded-lg px-2 py-1">
                <div className="h-4 w-4 rounded-full bg-purple-500" />
                <span className="text-xs font-bold">{t("SOL")}</span>
              </div>
            </div>
          </div>
          <div className="flex justify-center">
            <div className="bg-primary/10 flex h-8 w-8 items-center justify-center rounded-full">
              <ArrowUpDown className="text-primary h-4 w-4" />
            </div>
          </div>
          <div className="bg-base-200/60 rounded-xl p-3">
            <p className="text-neutral-content mb-1 text-xs">{t("You receive")}</p>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold">1,520.00</span>
              <div className="bg-base-100 flex items-center gap-1.5 rounded-lg px-2 py-1">
                <div className="h-4 w-4 rounded-full bg-blue-500" />
                <span className="text-xs font-bold">{t("USDC")}</span>
              </div>
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "tokens",
      icon: Lock,
      title: "Token-2022 Creation",
      desc: "Create fungible tokens and NFTs with Token-2022 extensions. Metadata, images, and IPFS pinning — all built in.",
      highlights: ["Fungible & NFTs", "Token-2022 extensions", "IPFS via Pinata"],
      preview: (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="from-primary/20 to-success/20 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br">
              <ImageIcon className="text-primary h-8 w-8" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold">{t("ACME Token")}</p>
              <p className="text-neutral-content font-mono text-xs">{t("Supply 1000000")}</p>
              <div className="mt-1 flex gap-1">
                <span className="bg-primary/10 text-primary rounded px-1.5 py-0.5 text-xs font-bold">
                  {t("Token2022")}
                </span>
                <span className="bg-success/10 text-success rounded px-1.5 py-0.5 text-xs font-bold">
                  {t("Metadata")}
                </span>
              </div>
            </div>
          </div>
          <div className="bg-base-200 h-1.5 w-full overflow-hidden rounded-full">
            <div className="from-primary to-success h-full w-3/4 rounded-full bg-linear-to-r" />
          </div>
          <p className="text-neutral-content text-center text-xs">
            {t("Uploading metadata to IPFS")}
          </p>
        </div>
      ),
    },
    {
      id: "programs",
      icon: Code2,
      title: "Program Upgrades",
      desc: "Manage Solana program upgrade authorities through multi-sig governance. No single point of failure.",
      highlights: ["Upgrade authority", "Multi-sig controlled", "Program registry"],
      preview: (
        <div className="space-y-2">
          <div className="bg-base-200/60 rounded-xl p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="text-primary h-4 w-4" />
                <span className="text-xs font-bold">{t("myprogramso")}</span>
              </div>
              <span className="bg-warning/10 text-warning rounded px-1.5 py-0.5 text-xs font-bold">
                {t("Upgrade Pending")}
              </span>
            </div>
            <div className="text-neutral-content font-mono text-xs">
              {t("Authority 8xKq3mRv Team Vault")}
            </div>
          </div>
          <div className="bg-success/5 flex items-center gap-2 rounded-xl p-2.5">
            <Check className="text-success h-3.5 w-3.5" />
            <span className="text-success text-xs">{t("Requires 3/5 approval to upgrade")}</span>
          </div>
        </div>
      ),
    },
  ];
}
function FeatureTabs() {
  const [active, setActive] = useState(0);
  const t = useTranslations("create");
  const FEATURES_DATA = getFeaturesData(t);
  const ref = useRef<HTMLDivElement>(null);
  useInView(ref, { once: true, margin: "-80px" });

  return (
    <div ref={ref}>
      <div className="mb-6 flex flex-wrap justify-center gap-2">
        {FEATURES_DATA.map((f, i) => {
          const Icon = f.icon;
          return (
            <button
              key={f.id}
              onClick={() => setActive(i)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all ${
                active === i
                  ? "bg-primary shadow-primary/20 text-white shadow-lg"
                  : "bg-primary/10 text-base-content"
              }`}
            >
              <Icon className="h-4 w-4" />
              <span
                className={`max-sm:hidden ${active === i ? "text-white" : "text-base-content"}`}
              >
                {f.title}
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3 }}
          className="glass-card overflow-hidden"
        >
          <div className="grid md:grid-cols-2">
            <div className="flex flex-col justify-center p-8">
              <div className="bg-primary/10 mb-4 flex h-12 w-12 items-center justify-center rounded-2xl">
                {(() => {
                  const Icon = FEATURES_DATA[active].icon;
                  return <Icon className="text-primary h-6 w-6" />;
                })()}
              </div>
              <h3 className="mb-2 text-xl font-bold">{FEATURES_DATA[active].title}</h3>
              <p className="text-neutral-content mb-6 text-sm leading-relaxed">
                {FEATURES_DATA[active].desc}
              </p>
              <div className="flex flex-col gap-2">
                {FEATURES_DATA[active].highlights.map((h) => (
                  <div key={h} className="flex items-center gap-2">
                    <div className="bg-success/10 flex h-5 w-5 items-center justify-center rounded-md">
                      <Check className="text-success h-3 w-3" />
                    </div>
                    <span className="text-sm font-medium">{h}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-primary/10 flex items-center justify-center p-8">
              <div className="w-full max-w-xs">{FEATURES_DATA[active].preview}</div>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

const TECH_STACK = [
  { name: "Next.js 16", desc: "App Router", color: "bg-gray-900 text-white" },
  { name: "TypeScript", desc: "Type-safe", color: "bg-blue-600 text-white" },
  {
    name: "Solana",
    desc: "Web3.js",
    color: "bg-gradient-to-r from-purple-600 to-green-400 text-white",
  },
  { name: "MongoDB", desc: "Mongoose", color: "bg-green-700 text-white" },
  { name: "Tailwind 4", desc: "DaisyUI 5", color: "bg-sky-500 text-white" },
  { name: "Jupiter", desc: "Swap API", color: "bg-teal-500 text-white" },
  { name: "Pinata", desc: "IPFS", color: "bg-purple-600 text-white" },
  { name: "React Query", desc: "TanStack", color: "bg-red-500 text-white" },
];

const stagger = {
  container: {
    hidden: {},
    visible: { transition: { staggerChildren: 0.08 } },
  },
  item: {
    hidden: { opacity: 0, y: 24 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  },
};

export default function HomePage() {
  const router = useRouter();
  const t = useTranslations("create");
  const { connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { isAuthenticated, isLoading: authLoading, login, error: authError } = useAuth();
  const { data: accessData, isLoading: accessLoading } = useTeamAccess();

  const userClickedConnect = useRef(false);
  const signingInRef = useRef(false);
  const [signingIn, setSigningIn] = useState(false);

  useEffect(() => {
    if (
      userClickedConnect.current &&
      connected &&
      !isAuthenticated &&
      !authLoading &&
      !signingInRef.current
    ) {
      userClickedConnect.current = false;
      signingInRef.current = true;
      Promise.resolve().then(() => {
        setSigningIn(true);
        login().finally(() => {
          signingInRef.current = false;
          setSigningIn(false);
        });
      });
    }
  }, [connected, isAuthenticated, authLoading, login]);

  useEffect(() => {
    if (isAuthenticated && accessData && !accessLoading && accessData.hasTeams) {
      router.push("/dashboard");
    }
  }, [isAuthenticated, accessData, accessLoading, router]);

  const handleConnect = () => {
    userClickedConnect.current = true;
    setVisible(true);
  };

  const handleSignIn = () => {
    setSigningIn(true);
    login().finally(() => setSigningIn(false));
  };

  const isProcessing = connecting || signingIn;
  const showNoTeamsCTA = isAuthenticated && !accessLoading && accessData && !accessData.hasTeams;
  const showConnectButton = !connected && !isProcessing && !authLoading;
  const showSignInButton = connected && !isAuthenticated && !authLoading && !isProcessing;

  const statsRef = useRef(null);
  const statsInView = useInView(statsRef, { once: true, margin: "-80px" });
  const techRef = useRef(null);
  const techInView = useInView(techRef, { once: true, margin: "-80px" });

  const renderCTAButton = (variant: "primary" | "white" = "primary") => {
    const base =
      variant === "white"
        ? "bg-white text-primary shadow-lg"
        : "bg-primary text-primary-content shadow-lg shadow-primary/20 hover:shadow-primary/30";

    if (showConnectButton)
      return (
        <button
          onClick={handleConnect}
          className={`group relative inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-bold transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] ${base}`}
        >
          <Wallet className="h-5 w-5" />
          {t("Connect Wallet")}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
          {variant === "primary" && (
            <span className="bg-primary/20 absolute -inset-1 -z-10 animate-pulse rounded-2xl blur-lg" />
          )}
        </button>
      );

    if (showSignInButton)
      return (
        <button
          onClick={handleSignIn}
          className={`group inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-bold transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] ${base}`}
        >
          <Shield className="h-5 w-5" />
          {t("Sign In")}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </button>
      );

    if (showNoTeamsCTA)
      return (
        <button
          onClick={() => router.push("/create")}
          className={`group inline-flex items-center gap-3 rounded-2xl px-8 py-4 text-lg font-bold transition-all hover:-translate-y-0.5 hover:shadow-xl active:scale-[0.98] ${base}`}
        >
          <Users className="h-5 w-5" />
          {t("Create Team Wallet")}
          <ArrowRight className="h-5 w-5 transition-transform group-hover:translate-x-1" />
        </button>
      );

    if (authLoading || (isAuthenticated && accessLoading))
      return <div className="loading loading-spinner loading-md text-primary" />;

    return null;
  };

  return (
    <div className="z-10 w-full">
      <section className="relative flex min-h-[calc(100dvh-64px)] w-full items-center overflow-hidden">
        <div className="from-primary/8 via-primary/3 pointer-events-none absolute inset-0 bg-linear-to-br to-transparent" />
        <div className="bg-primary/20 pointer-events-none absolute -top-32 -left-32 h-80 w-80 rounded-full blur-3xl" />
        <div className="pointer-events-none absolute -right-32 -bottom-32 h-80 w-80 rounded-full bg-[#23aa9b]/15 blur-3xl" />
        <div className="bg-primary/10 pointer-events-none absolute top-1/3 right-1/4 hidden h-40 w-40 rounded-full blur-3xl md:block" />

        <NetworkCanvas />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="mx-auto max-w-3xl space-y-6 text-center"
          >
            <motion.span
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="border-primary/20 bg-primary/5 text-primary inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-semibold backdrop-blur-sm"
            >
              <Globe className="h-3.5 w-3.5" />
              {t("Multisig Treasury on Solana")}
            </motion.span>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3, duration: 0.6 }}
              className="text-5xl! leading-[1.1]! font-black tracking-tight sm:text-6xl! lg:text-7xl!"
            >
              {t("title")}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="text-neutral-content mx-auto max-w-xl text-base! leading-relaxed sm:text-lg!"
            >
              {t(
                "Create a shared wallet add your team and manage assets with multisignature security Every transaction requires approval from your team before execution"
              )}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7, duration: 0.5 }}
              className="flex flex-col items-center gap-4 pt-4"
            >
              {showSignInButton && (
                <div className="flex flex-col items-center gap-3">
                  <div className="border-success/20 bg-success/10 rounded-2xl border p-3">
                    <div className="text-success flex items-center gap-2 text-sm font-medium">
                      <span className="bg-success h-2 w-2 animate-pulse rounded-full" />
                      {t("Wallet connected")}
                    </div>
                  </div>
                  <p className="text-neutral-content text-sm">
                    {t("Sign a message to authenticate")}
                  </p>
                </div>
              )}

              {isProcessing && (
                <div className="flex flex-col items-center gap-3">
                  <div className="border-primary/20 bg-primary/10 flex h-12 w-12 animate-pulse items-center justify-center rounded-2xl border">
                    <Wallet className="text-primary h-6 w-6" />
                  </div>
                  <p className="text-neutral-content text-sm">
                    {connecting ? "Connecting wallet..." : "Sign the message in your wallet..."}
                  </p>
                </div>
              )}

              {showNoTeamsCTA && (
                <div className="flex flex-col items-center gap-3">
                  <div className="border-success/20 bg-success/10 rounded-2xl border p-3">
                    <div className="text-success flex items-center gap-2 text-sm font-medium">
                      <span className="bg-success h-2 w-2 animate-pulse rounded-full" />
                      {t("Wallet connected")}
                    </div>
                  </div>
                  <p className="text-neutral-content max-w-md text-sm">{t("teamcreate")}</p>
                </div>
              )}

              {authError && (
                <div className="border-error/20 bg-error/10 rounded-xl border px-4 py-2">
                  <p className="text-error text-sm">{authError}</p>
                </div>
              )}

              {renderCTAButton("primary")}

              {showConnectButton && (
                <p className="text-neutral-content text-xs">
                  {t("Phantom Solflare Backpack All standard wallets")}
                </p>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              className="pt-12"
            >
              <motion.div
                animate={{ y: [0, 8, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="border-neutral-content/20 mx-auto flex h-10 w-6 items-start justify-center rounded-full border-2 p-1"
              >
                <div className="bg-neutral-content/40 h-2 w-1 rounded-full" />
              </motion.div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#f0fdf9] py-20">
        <div className="pointer-events-none absolute -top-20 -right-20 h-60 w-60 rounded-full bg-[#0d9488]/8 blur-3xl" />
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <span className="border-primary/20 bg-primary/5 text-primary mb-4 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold">
              <Eye className="h-3 w-3" />
              {t("Live Preview")}
            </span>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("Watch proposals flow in real time")}
            </h2>
            <p className="text-neutral-content mx-auto max-w-lg">{t("description")}</p>
          </motion.div>
          <ProposalFlowDemo />
        </div>
      </section>

      <section className="relative overflow-hidden bg-[#f5f3ff] py-20">
        <div className="pointer-events-none absolute -bottom-20 -left-20 h-60 w-60 rounded-full bg-[#7c3aed]/8 blur-3xl" />
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#7c3aed]/20 bg-[#7c3aed]/5 px-3 py-1 text-xs font-semibold text-[#7c3aed]">
              <Sparkles className="h-3 w-3" />
              {t("Feature Set")}
            </span>
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("Everything your team needs")}
            </h2>
            <p className="text-neutral-content mx-auto max-w-lg">
              {t(
                "From treasury to token creation manage all your onchain operations through one secure interface"
              )}
            </p>
          </motion.div>
          <FeatureTabs />
        </div>
      </section>

      <section className="bg-base-100 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("Up and running in 60 seconds")}
            </h2>
            <p className="text-neutral-content mx-auto max-w-md">
              {t("Three steps No CLI No config files Just connect and go")}
            </p>
          </motion.div>

          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-6 md:grid-cols-3"
          >
            {[
              {
                num: "01",
                icon: Wallet,
                title: "Connect Wallet",
                desc: "Phantom, Solflare, Backpack — any Solana wallet works out of the box.",
              },
              {
                num: "02",
                icon: Users,
                title: "Create a Team",
                desc: "Add members by wallet address, set voting threshold, and deploy your multi-sig vault.",
              },
              {
                num: "03",
                icon: Zap,
                title: "Start Managing",
                desc: "Create proposals, vote as a team, and execute transactions — all on-chain.",
              },
            ].map((step, i) => (
              <motion.div
                key={step.num}
                variants={stagger.item}
                className="glass-card group relative overflow-hidden p-6 transition-all hover:shadow-lg"
              >
                <div className="relative">
                  <div className="bg-primary/10 group-hover:bg-primary mb-4 flex h-12 w-12 items-center justify-center rounded-2xl transition-colors">
                    <step.icon className="text-primary group-hover:text-primary-content h-6 w-6" />
                  </div>
                  <h3 className="mb-2 text-lg font-bold">{step.title}</h3>
                  <p className="text-neutral-content text-sm leading-relaxed">{step.desc}</p>
                </div>
                {i < 2 && (
                  <ChevronRight className="text-neutral-content/30 absolute top-1/2 right-4 hidden h-5 w-5 -translate-y-1/2 md:block" />
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section ref={statsRef} className="bg-[#f5f3ff] py-20">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">
              {t("Trusted by teams everywhere")}
            </h2>
            <p className="text-neutral-content mx-auto max-w-md">
              {t("Powering secure treasury management for DAOs startups and teams on Solana")}
            </p>
          </motion.div>

          <motion.div
            variants={stagger.container}
            initial="hidden"
            animate={statsInView ? "visible" : "hidden"}
            className="grid grid-cols-2 gap-4 md:grid-cols-4"
          >
            {[
              {
                label: "Proposals Executed",
                value: 12400,
                suffix: "+",
                icon: Vote,
                color: "text-primary",
                bg: "bg-primary/10",
              },
              {
                label: "Teams Created",
                value: 850,
                suffix: "+",
                icon: Users,
                color: "text-[#7c3aed]",
                bg: "bg-[#7c3aed]/10",
              },
              {
                label: "SOL Secured",
                value: 240000,
                suffix: "",
                icon: ShieldCheck,
                color: "text-[#0d9488]",
                bg: "bg-[#0d9488]/10",
              },
              {
                label: "Uptime",
                value: 99,
                suffix: ".9%",
                icon: Zap,
                color: "text-[#f59e0b]",
                bg: "bg-[#f59e0b]/10",
              },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <motion.div
                  key={stat.label}
                  variants={stagger.item}
                  className="border-base-200 bg-base-100 flex flex-col items-center gap-3 rounded-2xl border p-8 shadow-sm transition-all hover:shadow-md"
                >
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl ${stat.bg}`}
                  >
                    <Icon className={`h-7 w-7 ${stat.color}`} />
                  </div>
                  <AnimatedCounter
                    target={stat.value}
                    suffix={stat.suffix}
                    className={`text-3xl font-black sm:text-4xl ${stat.color}`}
                  />
                  <span className="text-neutral-content text-sm font-medium">{stat.label}</span>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      <section className="bg-base-100 py-20">
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="mb-12 text-center"
          >
            <h2 className="mb-3 text-3xl font-bold sm:text-4xl">{t("Why Team Wallet")}</h2>
            <p className="text-neutral-content mx-auto max-w-md">
              {t("Stop sending SOL from a single wallet and hoping for the best")}
            </p>
          </motion.div>

          <motion.div
            variants={stagger.container}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "-80px" }}
            className="grid gap-6 md:grid-cols-2"
          >
            <motion.div
              variants={stagger.item}
              className="relative overflow-hidden rounded-2xl border border-red-200 bg-linear-to-br from-red-50 to-white p-8"
            >
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-red-100/60 blur-2xl" />
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">
                    <Shield className="h-5 w-5 text-red-500" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-red-600">{t("Without Multisig")}</h3>
                    <p className="text-xs text-red-400">{t("Single wallet management")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    {
                      text: "Single private key controls everything",
                      sub: "One person holds all the power",
                    },
                    { text: "One compromised wallet = total loss", sub: "No recovery, no backup" },
                    {
                      text: "No audit trail for team spending",
                      sub: "Zero accountability or transparency",
                    },
                    { text: "Trust-based, not verifiable", sub: "Hope your teammate is honest" },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
                        <span className="text-xs font-bold text-red-500">✕</span>
                      </div>
                      <div>
                        <p className="text-base-content text-sm font-semibold">{item.text}</p>
                        <p className="text-neutral-content text-xs">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>

            <motion.div
              variants={stagger.item}
              className="relative overflow-hidden rounded-2xl border border-emerald-200 bg-linear-to-br from-emerald-50 to-white p-8 shadow-lg shadow-emerald-100/50"
            >
              <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-emerald-100/60 blur-2xl" />
              <div className="absolute top-4 right-4 rounded-full bg-emerald-500 px-3 py-1 text-xs font-bold text-white shadow-sm">
                {t("RECOMMENDED")}
              </div>
              <div className="relative">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
                    <ShieldCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-emerald-700">{t("With Team Wallet")}</h3>
                    <p className="text-xs text-emerald-500">{t("Multisig governance")}</p>
                  </div>
                </div>
                <div className="space-y-4">
                  {[
                    {
                      text: "M-of-N signers for every transaction",
                      sub: "Configurable approval thresholds",
                    },
                    {
                      text: "No single point of failure",
                      sub: "Even if one key is lost, funds are safe",
                    },
                    {
                      text: "Full on-chain proposal history",
                      sub: "Every action is logged and auditable",
                    },
                    {
                      text: "Verifiable, transparent, trustless",
                      sub: "Code enforces rules, not people",
                    },
                  ].map((item) => (
                    <div key={item.text} className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                        <Check className="h-3 w-3 text-emerald-600" />
                      </div>
                      <div>
                        <p className="text-base-content text-sm font-semibold">{item.text}</p>
                        <p className="text-neutral-content text-xs">{item.sub}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      <section ref={techRef} className="relative overflow-hidden bg-[#f0f4f8] py-16">
        <div className="bg-primary/6 pointer-events-none absolute -bottom-20 left-1/3 h-60 w-60 rounded-full blur-3xl" />
        <div className="mx-auto max-w-5xl px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="mb-8 text-center"
          >
            <h2 className="mb-3 text-2xl font-bold">{t("Built with modern stack")}</h2>
            <p className="text-neutral-content text-sm">
              {t("Production ready Fully typed Welldocumented")}
            </p>
          </motion.div>

          <motion.div
            variants={stagger.container}
            initial="hidden"
            animate={techInView ? "visible" : "hidden"}
            className="flex flex-wrap justify-center gap-3"
          >
            {TECH_STACK.map((tech) => (
              <motion.div key={tech.name} variants={stagger.item}>
                <div
                  className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ${tech.color}`}
                >
                  {tech.name}
                  <span className="rounded bg-white/20 px-1.5 py-0.5 text-xs font-medium">
                    {tech.desc}
                  </span>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      <section className="bg-base-100 px-4 pt-8 pb-20">
        <div className="mx-auto max-w-5xl">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.5 }}
            className="bg-primary text-primary-content shadow-primary/30 relative overflow-hidden rounded-3xl p-12 text-center shadow-2xl"
          >
            <div className="absolute -top-24 -right-24 h-48 w-48 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute -bottom-24 -left-24 h-48 w-48 rounded-full bg-white/5 blur-2xl" />

            <div className="relative">
              <h2 className="mb-4 text-3xl font-bold sm:text-4xl">{t("readyTitle")}</h2>
              <p className="text-primary-content/70 mx-auto mb-8 max-w-lg text-base">
                {t(
                  "Deploy your multisig wallet in under a minute No CLI required  just connect your wallet and start managing"
                )}
              </p>
              {renderCTAButton("white")}
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}
