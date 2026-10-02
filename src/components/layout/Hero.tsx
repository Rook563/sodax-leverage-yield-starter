/** Primary-surface hero band: one display title with an accent word. */
export function Hero() {
  return (
    <section className="bg-hero text-hero-foreground">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <h1 className="font-display text-4xl leading-tight sm:text-5xl">
          Pick your <span className="font-accent text-hero-accent">card</span>
        </h1>
      </div>
    </section>
  );
}
