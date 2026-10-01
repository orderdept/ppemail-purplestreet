// Retired operator modules retain historical rows; active authority is private Hostcats.
export function assertActiveModule(moduleKey: string) {
  if (moduleKey === "purple-prices-email" || moduleKey === "pep-customers") {
    throw new Error("This operator module has been retired.");
  }
}
export function moduleIsRetired(moduleKey: string) {
  return moduleKey === "purple-prices-email" || moduleKey === "pep-customers";
}
