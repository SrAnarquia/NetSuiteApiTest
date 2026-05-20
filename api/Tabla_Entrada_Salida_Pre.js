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
           FETCH PARALLEL
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
           BALANCE APERTURA
        ========================================= */

        let openingBalance = 0;

        if (
            Array.isArray(balanceData)
            && balanceData.length > 0
        ) {

            openingBalance =
                Number(balanceData[0].total || 0);

        }


        /* =========================================
           MAPEAR SALIDAS
        ========================================= */

        const salidaMap = {};

        salidaData.forEach(item => {

            salidaMap[item.weekStart] = {

                totalOutflow:
                    Number(item.totalOutflow || 0)

            };

        });


        /* =========================================
           PREVISION
        ========================================= */

        let previousForecast = openingBalance;

        const table = entradaData.map((entrada, index) => {

            const weekStart =
                entrada.weekStart;

            const totalInflow =
                Number(entrada.totalInflow || 0);

            const totalOutflow =
                Number(
                    salidaMap[weekStart]?.totalOutflow || 0
                );

            /* =====================================
               FORMULA REAL

               PREV =
               ENTRADA
               - SALIDA
               + PREVISION ANTERIOR
            ===================================== */

            const currentForecast =
                totalInflow
                - totalOutflow
                + previousForecast;

            /* guardar para siguiente semana */
            previousForecast = currentForecast;


            return {

                "SEMANA DEL":
                    weekStart,

                "ENTRADA (MXN)":
                    Number(
                        totalInflow.toFixed(2)
                    ),

                "SALIDA (MXN)":
                    Number(
                        totalOutflow.toFixed(2)
                    ),

                "PREVISIÓN (MXN)":
                    Number(
                        currentForecast.toFixed(2)
                    )

            };

        });


        /* =========================================
           RESPONSE
        ========================================= */

        return res.status(200).json({

            success: true,

            openingBalance:
                Number(openingBalance.toFixed(2)),

            data: table

        });

    } catch (error) {

        return res.status(500).json({

            success: false,
            error: error.message

        });

    }

}