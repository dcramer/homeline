declare module "machine-uuid" {
  type Callback = (deviceUUID: string) => void;

  const machineUuid = (callback: Callback) => {
    callback("");
  };

  export default machineUuid;
}
