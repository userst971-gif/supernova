import { motion } from 'framer-motion';

const chapters = [
  {
    number: '01',
    title: 'The Void',
    body: 'We start from black. Not the absence of color — the presence of everything that hasn’t happened yet. Every AURORA garment is born in #050505, the exact shade of the space between stars.',
  },
  {
    number: '02',
    title: 'The Light',
    body: 'Aurora, nebula, supernova. We study the sky’s most electric moments and pull them into cotton, fleece, and technical shell. What happens at 64°N stays in the fabric.',
  },
  {
    number: '03',
    title: 'The Wearer',
    body: 'You are not a customer. You are a coordinate. This brand only exists because somewhere in the dark, you decided to glow. We make the casing; you provide the core.',
  },
];

export default function Manifesto() {
  return (
    <section className="relative z-10 py-28">
      <div className="container-x">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-3xl text-center"
        >
          <p className="text-[11px] uppercase tracking-[0.5em] text-aurora-300/80">The Brand Manifesto</p>
          <h2 className="text-glow-soft mt-4 text-4xl font-bold text-white sm:text-5xl md:text-6xl">
            Born in the dark.
            <br />
            Built to <span className="text-aurora-400">ignite.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-sm leading-relaxed text-white/55">
            AURORA is a celebration of the moment a star decides it’s had enough of quiet.
            Limited drops. Heavyweight fabric. Zero gravity on the price tag.
          </p>
        </motion.div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {chapters.map((c, i) => (
            <motion.div
              key={c.number}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.7, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
              className="card-dark group p-8 transition-colors duration-300 hover:border-aurora-400/30"
            >
              <span className="text-glow-green font-mono text-sm text-aurora-400">{c.number}</span>
              <h3 className="mt-4 text-xl font-semibold tracking-wide text-white">{c.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-white/50">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
