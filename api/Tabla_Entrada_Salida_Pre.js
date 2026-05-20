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
           FETCH
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

        const balanceData =
            await balanceResponse.json();

        const entradaData =
            await entradaResponse.json();

        const salidaData =
            await salidaResponse.json();


        /* =========================================
           BALANCE INICIAL
        ========================================= */

        let previousForecast =
            Number(balanceData[0]?.total || 0);


        /* =========================================
           MAP SALIDAS
        ========================================= */

        const salidaMap = {};

        salidaData.forEach(item => {

            salidaMap[item.weekStart] = item;

        });


        /* =========================================
           FORMATO POWER BI
        ========================================= */

        const result = entradaData.map(entrada => {

            const weekStart =
                entrada.weekStart;

            const inflow =
                Number(entrada.totalInflow || 0);

            const outflow =
                Number(
                    salidaMap[weekStart]?.totalOutflow || 0
                );

            /* =====================================
               PREVISION ACUMULADA
            ===================================== */

            const forecast =
                previousForecast
                + inflow
                - outflow;

            previousForecast = forecast;


            /* =====================================
               FORMATO TABLA FINAL
            ===================================== */

            return {

                "SEMANA DEL":
                    weekStart,

                "ENTRADA (MXN)":
                    Number(
                        inflow.toFixed(2)
                    ),

                "SALIDA (MXN)":
                    Number(
                        outflow.toFixed(2)
                    ),

                "PREVISIÓN (MXN)":
                    Number(
                        forecast.toFixed(2)
                    )

            };

        });


        /* =========================================
           RESPONSE DIRECTO
        ========================================= */

        return res.status(200).json(result);

    } catch (error) {

        return res.status(500).json({

            error: error.message

        });

    }

}