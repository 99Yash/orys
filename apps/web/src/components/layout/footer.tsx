import Link from "next/link";

const footerItems = [
  {
    title: "Platform",
    items: [
      { title: "Auctions", href: "/" },
      { title: "How it works", href: "/" },
    ],
  },
  {
    title: "Company",
    items: [
      { title: "About", href: "/" },
      { title: "Contact", href: "/" },
    ],
  },
  {
    title: "Legal",
    items: [
      { title: "Terms", href: "/" },
      { title: "Privacy", href: "/" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="w-full border-t bg-muted/40">
      <div className="container mx-auto flex flex-col gap-6 px-4 py-8">
        <div className="flex w-full flex-col gap-10 text-sm md:flex-row md:gap-5">
          <Link href="/" className="flex items-center gap-2 self-start pr-5">
            <div className="flex size-5 items-center justify-center rounded bg-brand text-[10px] font-bold text-white">
              O
            </div>
            <h1 className="text-sm font-semibold text-foreground">Orys</h1>
          </Link>

          <div className="flex w-full flex-row gap-12 pt-0.5 xl:justify-evenly">
            {footerItems.map((section) => (
              <div key={section.title} className="flex flex-col gap-3">
                <h5 className="text-xs font-medium text-foreground">
                  {section.title}
                </h5>
                <div className="flex flex-col gap-2 text-xs text-muted-foreground">
                  {section.items.map((item) => (
                    <Link key={item.title} href={item.href as "/"}>
                      {item.title}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}
