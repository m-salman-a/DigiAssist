import { DataStore } from './data_store';
import { SheetsAPI } from './sheets_api';

import {
	convertColumnToLetter,
	getColumn,
	getURL,
	parseSheetIndex,
} from '../utils';
import {
	PraktikumADT,
	Praktikum,
	PraktikumListADT,
	praktikumListFailure,
	praktikumListSuccess,
} from '../classes/praktikum';
import { Result } from '../classes/result';
import { matchI, matchPI } from 'ts-adt';

export class Repository {
	constructor(private dataStore: DataStore, private sheetsAPI: SheetsAPI) {}

	// TODO: this may also fail
	searchPraktikan(
		inputNPM: string,
		praktikumList: Praktikum[],
		modul: string
	): Result[] {
		let results: Result[] = [];
		praktikumList.forEach((praktikum) => {
			const data = praktikum.data;
			const index = data.findIndex(
				(praktikan) => praktikan['gsx$npm']['$t'] === inputNPM
			);
			if (index !== -1) {
				results.push({
					name: data[index]['gsx$nama']['$t'],
					prak_name: praktikum.name,
					url: getURL(
						praktikum.sheetID,
						praktikum.gid,
						convertColumnToLetter(
							getColumn(data[index]['content']['$t'], modul) + 1
						),
						index + 2
					),
				});
			}
		});
		return results;
	}

	async getPraktikumData(linkSheetID: string): Promise<PraktikumListADT> {
		const cachedData = await this.dataStore.fetch();
		return matchPI(cachedData)(
			{
				success: ({ value }) => {
					if (Date.now() - value.time > 3600 * 1000) {
						return this.fetchAndStoreSheets(linkSheetID);
					}
					return praktikumListSuccess(value.praktikumList);
				},
			},
			() => {
				return this.fetchAndStoreSheets(linkSheetID);
			}
		);
	}

	async fetchAndStoreSheets(linkSheetID: string): Promise<PraktikumListADT> {
		const masterSheetData = await this.fetchLinkSheet(linkSheetID);

		// If link sheet failed, then return the failure
		// else, return data as empty or success
		return matchI(masterSheetData)({
			failure: ({ value }) => {
				return praktikumListFailure(value.error);
			},
			success: async ({ value }) => {
				const fetchData = await this.fetchSheetsInArray(value.data);
				this.dataStore.store(fetchData);
				return praktikumListSuccess(fetchData);
			},
		});
	}

	// the name and gid is never used, so it is left empty
	private fetchLinkSheet(linkSheetID: string): Promise<PraktikumADT> {
		return this.sheetsAPI.fetchSheetPraktikum('', linkSheetID, '', 1);
	}

	// TODO: this may fail
	private fetchSheetsInArray(praktikumList: object[]): Promise<PraktikumADT[]> {
		return Promise.all<PraktikumADT>(
			praktikumList.map((sheet: object) => {
				return this.sheetsAPI.fetchSheetPraktikum(
					sheet['gsx$namapraktikum']['$t'],
					sheet['gsx$sheetid']['$t'],
					sheet['gsx$gid']['$t'],
					parseSheetIndex(sheet['gsx$sheetindex']['$t'])
				);
			})
		);
	}
}
