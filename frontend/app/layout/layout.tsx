import { Layout } from "../components/layout";
import { MantineProvider } from "@mantine/core";
import { theme } from "../components/shared/themes/saas.theme";
import { routes } from "./layout-menu";
import type { PropsWithChildren } from "react";

export function LayoutComponent({ children }: PropsWithChildren) {
  return (
    <MantineProvider theme={theme}>
      <Layout>
        <Layout.Nav>
          <Layout.NavHeader>logo area</Layout.NavHeader>
          <Layout.NavList>
            {routes.map((route) => (
              <Layout.NavItem to={route.path}>
                t
              </Layout.NavItem>
            ))}
          </Layout.NavList>
          <Layout.NavFooter>profile area</Layout.NavFooter>
        </Layout.Nav>
        { children }
      </Layout>
    </MantineProvider>
  );
}
