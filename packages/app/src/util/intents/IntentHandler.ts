import { NativeEventEmitter, NativeModules } from "react-native";
import {
  handleIngestEventWithUserStore,
  IngestEventEmitterType,
} from "./handleIngestEvent.js";

const { IngestEventEmitter } = NativeModules as {
  IngestEventEmitter: IngestEventEmitterType;
};

const eventEmitter = new NativeEventEmitter(IngestEventEmitter);

export function initIntentHandlers() {
  eventEmitter.addListener(
    "onIngestEvent",
    handleIngestEventWithUserStore(IngestEventEmitter),
  );
}
