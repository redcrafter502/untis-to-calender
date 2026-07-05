import { HexclaveHandler } from "@hexclave/next";
import { hexclaveServerApp } from "../../../stack";

export default function Handler(props: unknown) {
  return (
    <HexclaveHandler
      fullPage
      app={hexclaveServerApp}
      routeProps={props}
      componentProps={{
        SignIn: {
          automaticRedirect: true,
        },
        SignUp: {
          automaticRedirect: true,
        },
      }}
    />
  );
}
