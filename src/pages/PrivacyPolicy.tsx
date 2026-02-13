import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import Footer from "@/components/Footer";

const PrivacyPolicy = () => {
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
            <h1 className="font-editorial text-4xl md:text-5xl text-foreground mb-4">Privacy Policy</h1>
            <p className="text-muted-foreground font-body">Last updated: 12/02/2026</p>
            <div className="w-16 h-px bg-foreground/20 mt-4" />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.15 }}
            className="space-y-10 text-muted-foreground font-body text-base leading-relaxed"
          >
            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">1. Who We Are</h2>
              <p>signed is currently operated as a partnership based in the United Kingdom ("we", "us", "our").</p>
              <p className="mt-2">For the purposes of UK data protection law, we act as the data controller of your personal data.</p>
              <p className="mt-2">
                If you have any questions about this policy or your data, you can contact us at:{" "}
                <a href="mailto:support@signedletter.com" className="underline underline-offset-4 text-foreground hover:text-primary transition-colors">
                  support@signedletter.com
                </a>
              </p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">2. The Information We Collect</h2>
              <p>We may collect and process the following information:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Your email address</li>
                <li>Account details you provide when signing up</li>
                <li>Reflections or content you create within the platform</li>
                <li>Optional demographic information (such as year of birth or gender), if you choose to provide it</li>
                <li>Communications you send to us</li>
              </ul>
              <p className="mt-3">We do not use analytics tracking tools at this time.</p>
              <p className="mt-2">Providing optional demographic information is entirely voluntary.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">3. How We Use Your Information</h2>
              <p>We use your information to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Create and manage your account</li>
                <li>Provide and maintain the Signed service</li>
                <li>Store and deliver your reflections at your chosen time</li>
                <li>Communicate important service updates</li>
                <li>Send marketing emails if you have opted in</li>
                <li>Improve and develop the product</li>
              </ul>
              <p className="mt-3">We do not sell your personal data.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">4. Lawful Basis for Processing</h2>
              <p>Under UK data protection law, we rely on:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Contractual necessity</strong> – to provide your account and deliver the service</li>
                <li><strong>Legitimate interests</strong> – to improve and secure the platform</li>
                <li><strong>Consent</strong> – for marketing emails and any optional information you choose to provide</li>
              </ul>
              <p className="mt-3">You may withdraw consent for marketing at any time by unsubscribing.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">5. How We Store and Protect Your Data</h2>
              <p>Your reflections and account information are stored securely using third-party infrastructure providers.</p>
              <p className="mt-2">Reflection content is encrypted at rest.</p>
              <p className="mt-2">We implement appropriate technical and organisational measures to protect your personal data against unauthorised access, loss, misuse, or alteration.</p>
              <p className="mt-2">Access to user data is restricted.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">6. Third-Party Service Providers</h2>
              <p>We use trusted third-party providers to operate the platform, including:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li><strong>Supabase</strong> – for database hosting and infrastructure</li>
                <li><strong>EmailOctopus</strong> – for sending newsletter communications (if you subscribe)</li>
              </ul>
              <p className="mt-3">These providers process data on our behalf under contractual safeguards.</p>
              <p className="mt-2">Some data may be processed outside the UK. Where this occurs, we rely on appropriate legal safeguards.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">7. Data Retention</h2>
              <p>We retain account data for as long as your account is active.</p>
              <p className="mt-2">If you delete your account, we will delete or anonymise your personal data within a reasonable period, except where we are required to retain it for legal or security purposes.</p>
              <p className="mt-2">Marketing email data is retained until you unsubscribe.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">8. Your Rights</h2>
              <p>Under UK data protection law, you have the right to:</p>
              <ul className="list-disc pl-6 mt-2 space-y-1">
                <li>Access the personal data we hold about you</li>
                <li>Request correction of inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>Object to certain processing</li>
                <li>Withdraw consent (where applicable)</li>
              </ul>
              <p className="mt-3">To exercise these rights, contact us at the email above.</p>
              <p className="mt-2">You also have the right to lodge a complaint with the UK Information Commissioner's Office.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">9. Marketing Communications</h2>
              <p>If you subscribe to our newsletter, we will send you updates and communications about signed.</p>
              <p className="mt-2">You can unsubscribe at any time using the link in our emails.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">10. Children</h2>
              <p>signed is not intended for children under the age of 13.</p>
              <p className="mt-2">We do not knowingly collect personal data from children under 13.</p>
              <p className="mt-2">If we become aware that such data has been collected, we will delete it.</p>
            </section>

            <section>
              <h2 className="font-editorial text-xl text-foreground mb-3">11. Changes to This Policy</h2>
              <p>We may update this policy from time to time.</p>
              <p className="mt-2">The latest version will always be available on our website.</p>
            </section>
          </motion.div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default PrivacyPolicy;
