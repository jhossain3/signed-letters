import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/Footer";

const RefundPolicy = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex flex-col">
      <div className="absolute inset-0 paper-texture pointer-events-none opacity-50" />

      <main className="container mx-auto px-6 md:px-12 py-16 relative z-10 flex-1">
        <button
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-16"
        >
          <ArrowLeft className="w-5 h-5" />
          <span className="font-body">Back</span>
        </button>

        <div className="max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <h1 className="font-editorial text-4xl md:text-5xl text-foreground mb-4">Returns Policy</h1>
            <p className="text-muted-foreground font-body">Last updated: June 2026</p>
            <div className="w-16 h-px bg-foreground/20 mt-4" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="space-y-10 text-muted-foreground font-body text-base leading-relaxed"
          >
            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">Physical Letter Delivery</h2>
              <p>
                Because each letter is a physical, personalised item handwritten and prepared on your behalf, our returns policy reflects the nature of the product.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">Cancellations</h2>
              <p>
                You can cancel your order within 30 days of purchase, as long as your letter has not yet been handwritten and prepared for posting. Once writing has begun, we are unable to cancel or refund your order.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">Modifications</h2>
              <p>
                Need to update the recipient&apos;s name, postal address, or other delivery details? You can request changes up to 48 hours before the scheduled posting date. After this window closes, your order is locked and no changes can be made.
              </p>
              <p className="mt-2">
                To request a cancellation or modification, email{" "}
                <a
                  href="mailto:team@signedletter.com"
                  className="underline underline-offset-4 text-foreground hover:text-primary transition-colors"
                >
                  team@signedletter.com
                </a>{" "}
                with your order number and we&apos;ll get back to you as soon as we can.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">Lost or Damaged Letters</h2>
              <p>
                Physical letters are sent via Royal Mail second class and are not tracked. Once posted, the letter is in Royal Mail&apos;s care and Signed is not liable for letters that are lost, delayed, or damaged in transit.
              </p>
              <p className="mt-2">
                If your recipient hasn&apos;t received their letter within 10 working days of the expected posting date, please get in touch at{" "}
                <a
                  href="mailto:team@signedletter.com"
                  className="underline underline-offset-4 text-foreground hover:text-primary transition-colors"
                >
                  team@signedletter.com
                </a>
                . We are unable to guarantee a refund for letters lost in transit, but please get in touch and we&apos;ll do what we can to help.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">Digital Delivery</h2>
              <p>
                Digital letters are delivered via the Signed platform on your chosen date. As these are non-physical, intangible items, they are non-refundable once delivered.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">Your Vault</h2>
              <p>
                All letters — physical and digital — are stored in your account vault on the Signed platform. Physical letters remain sealed and unreadable until after your chosen posting date has passed, consistent with how digital letters work. Once delivered, your letter is available to view in your vault for as long as you keep your account.
              </p>
            </section>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default RefundPolicy;
