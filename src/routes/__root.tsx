import { getAccount } from "@/lib/account-session";
import { AccountProvider } from "@/lib/account";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AppShell } from "@/components/tenderpro/app-shell";
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()(
  {
    beforeLoad: async () => ({ account: await getAccount() }),
    head: () => ({
      meta: [
        { charSet: "utf-8" },
        { name: "viewport", content: "width=device-width, initial-scale=1" },
        { title: "TenderPro — AI Tender Analytics" },
        {
          name: "description",
          content: "TenderPro MVP — таблиця тендерів, картки та mock AI-агенти",
        },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
      links: [
        { rel: "stylesheet", href: appCss },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "preconnect",
          href: "https://fonts.gstatic.com",
          crossOrigin: "anonymous",
        },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&display=swap",
        },
        { rel: "icon", href: "/favicon.ico" },
      ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFound,
    errorComponent: ErrorPage,
  },
);
function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="uk">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
function RootComponent() {
  const { queryClient, account } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider account={account}>
        <AppShell key={account?.id ?? "guest"}>
          <Outlet />
        </AppShell>
      </AccountProvider>
    </QueryClientProvider>
  );
}
function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center">
      <div className="text-center">
        <h1 className="text-6xl font-bold">404</h1>
        <p className="my-4 text-muted-foreground">Сторінку не знайдено</p>
        <Link to="/tenders" className="text-primary">
          На головну
        </Link>
      </div>
    </div>
  );
}
function ErrorPage({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();
  useEffect(() => reportLovableError(error, { boundary: "root" }), [error]);
  return (
    <div className="grid min-h-screen place-items-center">
      <button
        onClick={() => {
          router.invalidate();
          reset();
        }}
      >
        Спробувати знову
      </button>
    </div>
  );
}
