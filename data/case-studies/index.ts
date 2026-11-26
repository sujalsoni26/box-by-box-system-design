// Guided interview exercises, one per case-study lesson. Each step asks first, offers a hint, then reveals
// the insight; the full worked answer is the lesson at /learn/<slug>. Validated by scripts/validate-practice.mjs.
// One file per case study (data/case-studies/<slug>.ts), in the order the Case studies page lists them.
import type { CaseStudy } from "@/types/case-study";
import { study as urlShortener } from "./url-shortener";
import { study as designPastebin } from "./design-pastebin";
import { study as designRateLimiter } from "./design-rate-limiter";
import { study as designNotificationSystem } from "./design-notification-system";
import { study as designKeyValueStore } from "./design-key-value-store";
import { study as designFileStorage } from "./design-file-storage";
import { study as designInstagram } from "./design-instagram";
import { study as designWhatsapp } from "./design-whatsapp";
import { study as designYoutube } from "./design-youtube";
import { study as designUber } from "./design-uber";
import { study as designNetflix } from "./design-netflix";
import { study as designEcommerce } from "./design-ecommerce";
import { study as designTicketBooking } from "./design-ticket-booking";
import { study as designPaymentSystem } from "./design-payment-system";
import { study as designSearchAutocomplete } from "./design-search-autocomplete";
import { study as lldParkingLot } from "./lld-parking-lot";
import { study as lldVendingMachine } from "./lld-vending-machine";
import { study as lldElevator } from "./lld-elevator";
import { study as lldLibraryManagement } from "./lld-library-management";
import { study as lldMovieTicketBooking } from "./lld-movie-ticket-booking";
import { study as lldSplitwise } from "./lld-splitwise";
import { study as lldSnakeAndLadder } from "./lld-snake-and-ladder";
import { study as lldChess } from "./lld-chess";
import { study as lldInMemoryCache } from "./lld-in-memory-cache";
import { study as lldLoggingFramework } from "./lld-logging-framework";
import { study as lldRateLimiter } from "./lld-rate-limiter";
import { study as lldTaskScheduler } from "./lld-task-scheduler";
import { study as lldRideBooking } from "./lld-ride-booking";
import { study as lldFoodOrdering } from "./lld-food-ordering";

export const caseStudies: CaseStudy[] = [
  urlShortener,
  designPastebin,
  designRateLimiter,
  designNotificationSystem,
  designKeyValueStore,
  designFileStorage,
  designInstagram,
  designWhatsapp,
  designYoutube,
  designUber,
  designNetflix,
  designEcommerce,
  designTicketBooking,
  designPaymentSystem,
  designSearchAutocomplete,
  lldParkingLot,
  lldVendingMachine,
  lldElevator,
  lldLibraryManagement,
  lldMovieTicketBooking,
  lldSplitwise,
  lldSnakeAndLadder,
  lldChess,
  lldInMemoryCache,
  lldLoggingFramework,
  lldRateLimiter,
  lldTaskScheduler,
  lldRideBooking,
  lldFoodOrdering,
];
