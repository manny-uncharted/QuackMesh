import LocalTesting from "./local-testing.mdx";
import DeployAws from "./deploy-aws.mdx";

export default function DocsIndex() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 space-y-12">
      <section id="local-testing">
        <LocalTesting />
      </section>
      <hr className="my-8 border-neutral-200" />
      <section id="deploy-aws">
        <DeployAws />
      </section>
    </main>
  );
}