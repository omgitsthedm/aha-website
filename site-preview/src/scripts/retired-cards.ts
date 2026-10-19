// Pages with product cards hide products removed from sale since the build.
import { catalogState, hideRetiredCards, pageHasProductCards } from "./catalog-state";

if (pageHasProductCards()) void catalogState().then((state) => hideRetiredCards(state.retired, state.known));
