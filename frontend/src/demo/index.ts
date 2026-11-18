/** The example data, typed. The JSON files are the single source. */
import automations from "./automations.json";
import changesets from "./changesets.json";
import house from "./house.json";
import net from "./net.json";
import netProposal from "./net-proposal.json";
import type {
  AutomationConfig,
  ChangeSet,
  House,
  Net,
} from "../model";

export const HOUSE = house as House;
export const AUTOMATIONS = automations as AutomationConfig[];
export const NET_EXISTING = net as Net;
export const NET_PROPOSAL = netProposal as Net;

const sets = changesets as ChangeSet[];
/** The prepared proposal, the first change set of the file. */
export const PROPOSAL: ChangeSet = sets[0];
/** Earlier change sets for the history list. */
export const HISTORY: ChangeSet[] = sets.slice(1);
