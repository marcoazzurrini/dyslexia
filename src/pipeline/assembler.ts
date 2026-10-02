import { Container } from "@cloudflare/containers";

export class AudioAssembler extends Container {
  defaultPort = 8080;
  sleepAfter = "2m";
}
