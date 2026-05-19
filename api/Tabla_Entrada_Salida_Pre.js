export default async function handler(req, res) {
    try {

        /* =========================================
           ENDPOINTS
        ========================================= */

        const BALANCE_URL =
            'https://netsuiteapitest.vercel.app/api/Balance_Apertura.js';

        const ENTRADA_URL =
            'https://netsuiteapitest.vercel.app/api/Entrada_Pre.js';

        const SALIDA_URL =
            'https://netsuiteapitest.vercel.app/api/Salida_Pre.js';


        /* =========================================
           FETCH EN PARALELO
        ========================================= */

        const [
            balanceResponse,
            entradaResponse,
            salidaResponse
        ] = await Promise.all([
            fetch(BALANCE_URL),
            fetch(ENTRADA_URL),
            fetch(SALIDA_URL)
        ]);


        /* =========================================
           JSON
        ========================================= */

        const balanceData = await balanceResponse.json();
        const entradaData = await entradaResponse.json();
        const salidaData = await salidaResponse.json();


        /* =========================================
           BALANCE DE APERTURA
        ========================================= */

        let openingBalance = 0;

        if (
            Array.isArray(balanceData) &&
            balanceData.length > 0
        ) {
            openingBalance = Number(balanceData[0].total || 0);
        }


        /* =========================================
           MAPEAR SALIDAS POR FECHA
        ========================================= */

        const salidaMap = {};

        salidaData.forEach(item => {

            salidaMap[item.weekStart] = {
                totalOutflow: Number(item.totalOutflow || 0)
            };

        });


        /* =========================================
           CALCULO FORECAST
        ========================================= */

        let runningForecast = openingBalance;

        const result = entradaData.map(entry => {

            const weekStart = entry.weekStart;

            const totalInflow =
                Number(entry.totalInflow || 0);

            const totalOutflow =
                Number(
                    salidaMap[weekStart]?.totalOutflow || 0
                );

            /* ================================
               FORMULA

               (ENTRADA - SALIDA)
               + BALANCE ACUMULADO
            ================================= */

            runningForecast =
                runningForecast
                + (totalInflow - totalOutflow);

            return {

                weekStart,

                totalInflow:
                    Number(totalInflow.toFixed(2)),

                totalOutflow:
                    Number(totalOutflow.toFixed(2)),

                forecast:
                    Number(runningForecast.toFixed(2))

            };

        });


        /* =========================================
           RESPONSE
        ========================================= */

        return res.status(200).json({
            openingBalance,
            data: result
        });

    } catch (error) {

        return res.status(500).json({
            success: false,
            error: error.message
        });

    }
}