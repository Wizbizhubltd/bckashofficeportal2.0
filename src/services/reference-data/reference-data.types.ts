/** `reference-data` tag — backashbackend/src/modules/reference-data. */
export interface NigeriaState {
  id: string;
  name: string;
}

/** Always carries its parent state's id/name alongside its own — see CityDto on the backend. */
export interface NigeriaCity {
  id: string;
  name: string;
  stateId: string;
  stateName: string;
}
