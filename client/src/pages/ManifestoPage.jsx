import Manifesto from '../components/Manifesto';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function ManifestoPage() {
  return (
    <div className="min-h-screen pt-28">
      <Manifesto />
      <div className="container-x pb-24 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
        >
          <p className="mx-auto max-w-xl text-sm leading-relaxed text-white/50">
            We release when the sky allows. No seasons, no restocks, no apologies.
            When the aurora shows, you show up.
          </p>
          <Link to="/shop" className="btn-aurora mt-8">
            WEAR THE NIGHT
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
