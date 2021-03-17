import express from "express";

export const webui = express();

webui.get("/", (req, res) => {
  res.send("The sedulous hyena ate the antelope!");
});
