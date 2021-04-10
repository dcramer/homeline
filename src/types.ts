export type Entity = {
  id: string;
  name: string;
  defaultState: string;
  state: string;
  attributes: {
    [key: string]: any;
  };
};
