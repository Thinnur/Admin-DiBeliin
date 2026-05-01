export const DEVICE_OPTIONS = ['HP 1', 'HP 2', 'HP 3', 'HP 4'] as const;

export const DEVICE_ALL_VALUE = 'all';
export const DEVICE_UNSET_VALUE = '__unset__';

export type DeviceName = (typeof DEVICE_OPTIONS)[number];
export type DeviceSelectValue = DeviceName | typeof DEVICE_UNSET_VALUE;
export type DeviceFilterValue =
    | typeof DEVICE_ALL_VALUE
    | typeof DEVICE_UNSET_VALUE
    | DeviceName;

const deviceOptionSet = new Set<string>(DEVICE_OPTIONS);

export function normalizeDeviceName(deviceName?: string | null): string | null {
    const normalized = deviceName?.trim();
    return normalized ? normalized : null;
}

export function isUnsetDevice(deviceName?: string | null): boolean {
    return normalizeDeviceName(deviceName) === null;
}

export function toDeviceSelectValue(deviceName?: string | null): DeviceSelectValue {
    const normalized = normalizeDeviceName(deviceName);
    if (normalized && deviceOptionSet.has(normalized)) {
        return normalized as DeviceName;
    }

    return DEVICE_UNSET_VALUE;
}

export function deviceSelectValueToPayload(value: DeviceSelectValue): string | null {
    return value === DEVICE_UNSET_VALUE ? null : value;
}
