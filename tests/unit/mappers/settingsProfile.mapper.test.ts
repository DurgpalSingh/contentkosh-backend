import { UpdateSettingsProfileDto } from '../../../src/dtos/settingsProfile.dto';
import { buildSettingsProfileUpdateInputs } from '../../../src/mappers/settingsProfile.mapper';

describe('buildSettingsProfileUpdateInputs', () => {
  it.each([true, false])('includes allowContentDownloads=%s in business updates', (allowContentDownloads) => {
    const payload = {
      businessDetails: { allowContentDownloads },
    } as UpdateSettingsProfileDto;

    expect(buildSettingsProfileUpdateInputs(payload).businessUpdate).toEqual({
      allowContentDownloads,
    });
  });
});
