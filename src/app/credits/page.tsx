import Link from "next/link";
export default function Credits() {
  return (
    <main className="standalone credit-list">
      <Link className="back-link" href="/app">
        ← Back to Petish
      </Link>
      <span className="eyebrow">WITH THANKS</span>
      <h1>The faces behind the demo.</h1>
      <p>
        All people and pet profiles in the demo are fictional. These photographs
        are used to illustrate them. Images are resized, converted to WebP for
        pet records, and may be cropped in the interface.
      </p>
      <article>
        <h2>Golden retriever</h2>
        <p>
          Nicole Qowens ·{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Golden_Retriever_lying_on_the_grass.jpg">
            Original photograph
          </a>{" "}
          ·{" "}
          <a href="https://creativecommons.org/licenses/by-sa/4.0/">
            CC BY-SA 4.0
          </a>
          . Resized and cropped adaptations remain under this licence.
        </p>
      </article>
      <article>
        <h2>Border collie</h2>
        <p>
          Thomas Vaclavek ·{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Border_Collie_panting.jpg">
            Original photograph
          </a>{" "}
          ·{" "}
          <a href="https://creativecommons.org/licenses/by-sa/2.0/">
            CC BY-SA 2.0
          </a>
          . Resized and cropped adaptations remain under this licence.
        </p>
      </article>
      <article>
        <h2>Tabby kitten</h2>
        <p>
          Dcoetzee ·{" "}
          <a href="https://commons.wikimedia.org/wiki/File:Tabby_kitten_profile_standing_facing_right.jpg">
            Original photograph
          </a>{" "}
          · Public domain.
        </p>
      </article>
    </main>
  );
}
