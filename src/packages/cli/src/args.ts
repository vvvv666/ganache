import { TruffleColors } from "@ganache/colors";
import yargs from "yargs";
import { StartArgs, GanacheArgs } from "./types";
import chalk from "chalk";
import { EOL } from "os";
import marked from "marked";
import TerminalRenderer from "marked-terminal";
import { configureFlavorOptions, loadFlavorFromArgs } from "./flavors";
import { center, highlight, wrapWidth } from "./helpers";

marked.setOptions({
  renderer: new TerminalRenderer({
    codespan: chalk.hex(TruffleColors.porsche),
    // Disable `unescape` since doesn't work for everything (we just do it ourselves)
    unescape: false
  })
});

const NEED_HELP = "Need more help? Reach out to the Truffle community at";
const COMMUNITY_LINK = "https://trfl.io/support";
const OR_DOCS = "or check out our docs at";
const DOCS_LINK = "https://ganache.dev";

export const parseArgs = (version: string, rawArgs = process.argv.slice(2)) => {
  const versionUsageOutputText = chalk`{hex("${
    TruffleColors.porsche
  }").bold ${center(version, version.length)}}`;

  // disable dot-notation because yargs just can't coerce args properly...
  // ...on purpose! https://github.com/yargs/yargs/issues/1021#issuecomment-352324693
  yargs
    .parserConfiguration({ "dot-notation": false })
    .strict()
    .usage(versionUsageOutputText)
    .epilogue(
      versionUsageOutputText +
        EOL +
        EOL +
        center(
          chalk`{hex("${TruffleColors.porsche}").bold ${NEED_HELP}} {hex("${TruffleColors.turquoise}") ${COMMUNITY_LINK}}`,
          (NEED_HELP + " " + COMMUNITY_LINK).length
        ) +
        EOL +
        center(
          chalk`{hex("${TruffleColors.porsche}").bold ${OR_DOCS}} {hex("${TruffleColors.turquoise}") ${DOCS_LINK}}`,
          (OR_DOCS + " " + DOCS_LINK).length
        )
    );

  const { flavor, options: flavorOptions } = loadFlavorFromArgs(rawArgs);
  configureFlavorOptions(yargs, flavor, flavorOptions);

  yargs.command(
    "instances",
    highlight(
      "Manage instances of Ganache running in detached mode." +
        EOL +
        "(Ganache can be run in detached mode by providing the `--detach` flag)"
    ),
    _yargs => {
      _yargs
        .command(
          "list",
          "List instances running in detached mode",
          _ => {},
          listArgs => {
            listArgs.action = "list";
          }
        )
        .command(
          "stop <name>",
          "Stop the instance specified by <name>",
          stopArgs => {
            stopArgs.positional("name", { type: "string" });
          },
          stopArgs => {
            stopArgs.action = "stop";
          }
        )
        .version(false);
    }
  );

  yargs
    .showHelpOnFail(false, "Specify -? or --help for available options")
    .alias("help", "?")
    .wrap(wrapWidth)
    .version(version);

  const parsedArgs = yargs.parse(rawArgs);
  let finalArgs: GanacheArgs;
  if (parsedArgs.action === "stop") {
    finalArgs = {
      action: "stop",
      name: parsedArgs.name as string
    };
  } else if (parsedArgs.action === "list") {
    finalArgs = { action: "list" };
  } else if (
    parsedArgs.action === "start" ||
    parsedArgs.action === "start-detached"
  ) {
    const action = parsedArgs.action;
    const flavor = (parsedArgs.flavor || "ethereum") as string | "ethereum";
    finalArgs = {
      flavor,
      action,
      ...(expandArgs(parsedArgs) as Omit<StartArgs<any>, "flavor" | "action">)
    };
  } else {
    throw new Error(`Unknown action: ${parsedArgs.action}`);
  }

  return finalArgs;
};

/**
 * Expands the arguments into an object including only namespaced keys from the
 * `args` argument.
 * @param  {object} args to be expanded
 * @returns {object} with the expanded arguments
 */
export function expandArgs(args: object): object {
  const namespacedArgs = {};

  for (const key in args) {
    // ignore keys that are kebab-cased - they will be duplicated as camelCase
    if (key.indexOf("-") === -1) {
      // split on the first "."
      const [namespace, option] = key.split(/\.(.+)/);
      // only copy namespaced/group keys, and ignore keys with kebab cases
      if (option) {
        if (!namespacedArgs[namespace]) {
          namespacedArgs[namespace] = {};
        }
        namespacedArgs[namespace][option] = args[key];
      }
    }
  }

  return namespacedArgs;
}
