import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowLeft, Instagram, MessageCircle } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const TikTokIcon = () => (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const faqs = [
  {
    question: "What is signed?",
    answer: "signed is a reflection tool that helps you pause, capture a moment, and revisit it later — with time, distance, and clarity.\n\nYou write something once, choose when you'll receive it, and we deliver it back to you in the future.\n\nIt's reflection with hindsight built in.",
  },
  {
    question: "How does it work?",
    answer: "It's simple:\n\n• You write a message to yourself\n• Choose a future delivery date\n• Sign and seal it\n• We send it back to you when the time comes\n\nUntil then, it stays unopened. No peeking, no editing and no unsending!",
  },
  {
    question: "Is this journalling?",
    answer: "Not quite.\n\nJournalling is often about processing thoughts in real time. signed is about writing for a future version of yourself — so when you read it back, you're able to reflect with perspective, growth, and honesty.\n\nMany people use both. They serve different purposes.",
  },
  {
    question: "What do people usually write?",
    answer: "Anything that matters to them. Common examples include:\n\n• Goals they're working towards\n• Reflections on a big life moment\n• Duas, intentions, or reminders\n• Notes to their future self during transitions\n• Check-ins at milestones (before Ramadan, after exams, career changes, graduation, weddings etc.)\n\nThere's no \"right\" way to use it.",
  },
  {
    question: "When do I get my message back?",
    answer: "You choose the delivery date when you write it — whether that's weeks, months, or a year from now.\n\nOnce it's written and signed, it's sealed until delivery.",
  },
  {
    question: "Can I edit a message after I've sent it?",
    answer: "No — and that's intentional.\n\nPart of the power of signed is honesty in the moment. Locking it in preserves that truth, so when you read it back, you're meeting your past self exactly as they were.",
  },
  {
    question: "Is my writing private?",
    answer: "Yes. Completely.\n\nYour messages are private and encrypted. No one reads them, and they're never shared. signed exists to serve you — not to mine your thoughts.",
  },
  {
    question: "Is signed faith-based?",
    answer: "signed is inspired by reflection — a practice deeply rooted in Islam — but the platform itself is open to everyone.\n\nYou don't need to be religious to use it, and you're free to reflect in whatever way feels authentic to you.",
  },
  {
    question: "Can I write to someone else?",
    answer: "Right now, signed is focused on writing to yourself.\n\nWriting to others is something we're exploring carefully for the future.",
  },
  {
    question: "What if something goes wrong?",
    answer: "If you experience a technical issue, don't worry — we're here to help.\n\nYou can reach us directly, and we'll get back to you as quickly as possible. As an early product, feedback also helps us improve, and we genuinely appreciate it.",
  },
  {
    question: "Is signed free to use?",
    answer: "signed is currently available as part of our early access period.\n\nWe're focused on building something meaningful and learning from our community. Any future changes will be communicated clearly and well in advance.",
  },
  {
    question: "Why should I try this?",
    answer: "Because most of us move through life without stopping long enough to notice how far we've come.\n\nsigned creates that pause — and gives you the gift of perspective later.",
  },
];

const FAQ = () => {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 paper-texture pointer-events-none opacity-50" />

      <main className="container mx-auto px-6 md:px-12 py-16 relative z-10 flex-1">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-16"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-body">Back</span>
        </Link>

        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="font-editorial text-4xl md:text-5xl text-foreground mb-4">FAQ</h1>
            <div className="w-16 h-px bg-foreground/20" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
          >
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((faq, i) => (
                <AccordionItem key={i} value={`item-${i}`} className="border-border/50">
                  <AccordionTrigger className="font-editorial text-lg text-foreground hover:no-underline py-5">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground font-body text-base leading-relaxed whitespace-pre-line pb-6">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 bg-card/30">
        <div className="container mx-auto px-4 py-6">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm font-body">Write through time</span>
            <div className="flex items-center gap-6">
              <a
                href="https://www.instagram.com/signed_letters"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <Instagram className="h-5 w-5" />
              </a>
              <a
                href="https://www.tiktok.com/@letters_for_later"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <TikTokIcon />
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Tally Feedback Button */}
      <button
        data-tally-open="VLzk5E"
        data-tally-emoji-text="💬"
        data-tally-emoji-animation="wave"
        className="fixed bottom-6 right-6 p-4 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-all shadow-lg hover:shadow-xl z-50 flex items-center justify-center"
        aria-label="Give feedback"
      >
        <MessageCircle className="w-6 h-6" />
      </button>
    </div>
  );
};

export default FAQ;
