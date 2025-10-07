import { type PropsWithChildren } from "react";
import { ActionIcon } from "@mantine/core";
import styles from "./nav-item.module.css";

export function NavItem({
  children,
  ...props
}: PropsWithChildren<any>) {
  const defaultProps = {
    radius: 8,
    role: "menuitem",
    className: styles["action-icon-nav-item"],
  };

  return (
    <li role="presentation" className={styles["nav-item"]}>
      {
        (
          <ActionIcon
            component="a"
            {...defaultProps}
            {...props}
          >
            {children}
          </ActionIcon>
        )
      }
    </li>
  );
}
