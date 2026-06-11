import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/Footer";

const TermsAndConditions = () => {
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
            <h1 className="font-editorial text-4xl md:text-5xl text-foreground mb-4">Terms of Service</h1>
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
              <h2 className="font-editorial text-xl text-foreground mb-3">1. The Service</h2>
              <p>
                Signed allows you to write letters that are sealed and delivered on a date of your choosing. Physical letter delivery is a paid feature, charged per letter at the point of purchase. Each letter is handwritten by our team and posted via Royal Mail second class.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">2. Payment</h2>
              <p>
                Physical letter delivery is a one-time purchase per letter. Payment is taken at the time of ordering. All prices are listed in GBP and are inclusive of applicable taxes.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">3. Cancellations</h2>
              <p>
                You may cancel your order up to 30 days after purchase, provided your letter has not yet been handwritten and prepared for posting. Once writing has begun, we are unable to cancel or refund your order.
              </p>
              <p className="mt-2">
                To cancel, contact us at{" "}
                <a
                  href="mailto:team@signedletter.com"
                  className="underline underline-offset-4 text-foreground hover:text-primary transition-colors"
                >
                  team@signedletter.com
                </a>{" "}
                with your order details.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">4. Modifications</h2>
              <p>
                Changes to delivery details — including recipient name and postal address — can be made up to 48 hours before the scheduled posting date on the website. After that point, your order is locked and no modifications can be accepted.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">5. Delivery</h2>
              <p>
                Physical letters are sent via Royal Mail second class. Estimated delivery times are 2–5 working days from the posting date, though we cannot guarantee delivery times as these are outside our control.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">6. Lost or Damaged Letters</h2>
              <p>
                Once a letter has been posted, it is in the care of Royal Mail. Signed does not accept responsibility for letters that are lost, delayed, or damaged in transit.
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
              <h2 className="font-editorial text-xl text-foreground mb-3">7. Your Vault</h2>
              <p>
                All letters — physical and digital — are stored in your account vault on the Signed platform. Physical letters remain sealed and unreadable until after your chosen posting date has passed, consistent with how digital letters work. Once delivered, your letter is available to view in your vault for as long as you keep your account.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">8. Your Content</h2>
              <p>
                You retain ownership of what you write. By using Signed, you confirm that your letter content does not violate any applicable laws. We do not read, store, or share your letter content beyond what is necessary to produce and deliver it.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">9. Changes to These Terms</h2>
              <p>
                We may update these terms from time to time. Continued use of Signed after changes are posted constitutes acceptance of the revised terms.
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">10. Contact</h2>
              <p>
                For any questions or concerns:{" "}
                <a
                  href="mailto:team@signedletter.com"
                  className="underline underline-offset-4 text-foreground hover:text-primary transition-colors"
                >
                  team@signedletter.com
                </a>
              </p>
            </section>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default TermsAndConditions;
