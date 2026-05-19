/**
 * @NApiVersion 2.1
 * @NScriptType Restlet
 */

define(['N/query', 'N/log'], (query, log) => {

    const get = (requestParams) => {

        try {

            const subsidiary =
                parseInt(requestParams.subsidiary, 10) || 2;

            const suiteQL = `

WITH preferenceTable AS (

    SELECT
        TO_NUMBER(d.custrecord_cash360_po_lead_time) AS po_lead_time,
        TO_NUMBER(d.custrecord_cash360_subsidiary) AS subsidiary

    FROM (

        SELECT
            p.*,

            ROW_NUMBER() OVER (
                PARTITION BY p.custrecord_cash360_subsidiary
                ORDER BY p.id
            ) AS rn

        FROM customrecord_cash360_preference p

    ) d

    WHERE d.rn = 1
),

/* PERIODOS */
periods AS (

    /* Semana actual */
    SELECT
        TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) - 7, 'DD/MM/YYYY') AS week_start,
        next_day(TRUNC(CURRENT_DATE), 2) - 1 AS period_end
    FROM dual

    UNION ALL

    /* Semana +1 */
    SELECT
        TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2), 'DD/MM/YYYY'),
        next_day(TRUNC(CURRENT_DATE), 2) + 6
    FROM dual

    UNION ALL

    /* Semana +2 */
    SELECT
        TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) + 7, 'DD/MM/YYYY'),
        next_day(TRUNC(CURRENT_DATE), 2) + 13
    FROM dual

    UNION ALL

    /* Semana +3 */
    SELECT
        TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) + 14, 'DD/MM/YYYY'),
        next_day(TRUNC(CURRENT_DATE), 2) + 20
    FROM dual

    UNION ALL

    /* Semana +4 */
    SELECT
        TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) + 21, 'DD/MM/YYYY'),
        next_day(TRUNC(CURRENT_DATE), 2) + 27
    FROM dual
),

/* PURCHASE ORDERS */
purchaseOrders AS (

    SELECT

        p.week_start,

        SUM(ABS(t.amountunbilled)) AS total_po

    FROM (

        SELECT

            (
                tran.trandate
                +
                NVL(
                    CASE
                        WHEN c.custrecord_c360_entity_n = '-'
                            THEN NVL(pref.po_lead_time, 0)

                        ELSE TO_NUMBER(c.custrecord_c360_entity_n)

                    END,
                    0
                )
                +
                NVL(trm.daysUntilNetDue, 0)

            ) AS periodDate,

            tran.amountunbilled

        FROM transaction tran,
             transactionline tl,
             customrecord_cash360_entity_data c,
             EntitySubsidiaryRelationship esr,
             preferenceTable pref,
             term trm

        WHERE
            tran.id = tl.transaction

            AND tl.mainline = 'T'

            AND tran.entity = c.custrecord_c360_entity(+)

            AND tran.entity = esr.entity(+)

            AND esr.isprimarysub = 'T'

            AND pref.subsidiary(+) = esr.subsidiary

            AND trm.id(+) = tran.terms

            AND tran.type = 'PurchOrd'

            AND tl.subsidiary = ${subsidiary}

            AND BUILTIN.CF(tran.status) IN (
                'PurchOrd:D',
                'PurchOrd:F',
                'PurchOrd:E',
                'PurchOrd:B'
            )

    ) t,

    periods p

    WHERE

        (
            (
                p.week_start =
                TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) - 7, 'DD/MM/YYYY')

                AND TRUNC(t.periodDate)
                    <= p.period_end
            )

            OR

            (
                p.week_start !=
                TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) - 7, 'DD/MM/YYYY')

                AND TRUNC(t.periodDate)
                    BETWEEN
                        TO_DATE(p.week_start,'DD/MM/YYYY')
                        AND p.period_end
            )
        )

    GROUP BY
        p.week_start
),

/* ACCOUNTS PAYABLE */
accountsPayable AS (

    SELECT

        p.week_start,

        (
            SUM(
                ABS(
                    NVL(tal.credit,0)
                    -
                    CASE
                        WHEN tran.type NOT IN ('FxReval')
                            THEN NVL(tal.amountlinked,0)
                        ELSE 0
                    END
                )
            )
            -
            SUM(NVL(tal.debit,0))
        ) AS total_ap

    FROM periods p,
         transaction tran,
         transactionline tl,
         transactionaccountingline tal,
         account acc

    WHERE
        tran.id = tl.transaction

        AND tl.id = tal.transactionline

        AND tl.transaction = tal.transaction

        AND tal.account = acc.id

        AND acc.accttype = 'AcctPay'

        AND tal.posting != 'F'

        AND tl.subsidiary IN (${subsidiary})

        AND (

            (
                p.week_start =
                TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) - 7, 'DD/MM/YYYY')

                AND TRUNC(NVL(tran.duedate, tran.trandate))
                    <= p.period_end
            )

            OR

            (
                p.week_start !=
                TO_CHAR(next_day(TRUNC(CURRENT_DATE), 2) - 7, 'DD/MM/YYYY')

                AND TRUNC(NVL(tran.duedate, tran.trandate))
                    BETWEEN
                        TO_DATE(p.week_start,'DD/MM/YYYY')
                        AND p.period_end
            )
        )

    GROUP BY
        p.week_start
),

/* IMPUESTOS PATRONALES */
employerTaxes AS (

    SELECT

        p.week_start,

        proj.weekly_total AS total_taxes

    FROM periods p

    CROSS JOIN (

        SELECT

            NVL((

                SELECT

                    CASE
                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_INFLOW')
                            THEN (SUM(amount) * -1)

                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_OUTFLOW')
                            THEN SUM(amount)

                    END

                FROM (

                    SELECT
                        tal.amount AS amount,
                        category.id AS categoryId

                    FROM
                        transaction trans,
                        transactionline tl,
                        transactionaccountingline tal,
                        account acc,
                        customrecord_cash360_account forecastAccount,
                        customrecord_cash360_accountcategory category

                    WHERE
                        trans.id = tl.transaction

                        AND tl.id = tal.transactionline

                        AND tal.account = acc.id

                        AND acc.id = forecastAccount.custrecord_cash360_account

                        AND forecastAccount.custrecord_cash360_category = category.id

                        AND tl.transaction = tal.transaction

                        AND tl.subsidiary = ${subsidiary}

                        AND trans.trandate BETWEEN
                            TRUNC(ADD_MONTHS(CURRENT_DATE, -3), 'MM')
                            AND LAST_DAY(ADD_MONTHS(CURRENT_DATE, -1))

                        AND forecastAccount.custrecord_cash360_useinprojection = 'T'

                        AND trans.posting != 'F'

                        AND category.name = 'Impuestos Patronales MOD'

                )

            ) / 13, 0) AS weekly_total

        FROM
            customrecord_cash360_accountcategory category,
            customrecord_cash360_categorymanager categorymanager,
            customrecord_cash360_preference pref,
            customlist_cash360_accountcategorytype categorytype

        WHERE
            categorymanager.custrecord_cash360_accountcategory = category.id

            AND categorymanager.custrecord_cash360_preference = pref.id

            AND categorytype.id = category.custrecord_cash360_accountcategorytype

            AND categorymanager.custrecord_cash360_category_use_in_proj = 'T'

            AND pref.custrecord_cash360_subsidiary = ${subsidiary}

            AND category.name = 'Impuestos Patronales MOD'

    ) proj
),

/* ISR */
isrTaxes AS (

    SELECT

        p.week_start,

        proj.weekly_total AS total_isr

    FROM periods p

    CROSS JOIN (

        SELECT

            NVL((

                SELECT

                    CASE
                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_INFLOW')
                            THEN (SUM(amount) * -1)

                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_OUTFLOW')
                            THEN SUM(amount)

                    END

                FROM (

                    SELECT
                        tal.amount AS amount,
                        category.id AS categoryId

                    FROM
                        transaction trans,
                        transactionline tl,
                        transactionaccountingline tal,
                        account acc,
                        customrecord_cash360_account forecastAccount,
                        customrecord_cash360_accountcategory category

                    WHERE
                        trans.id = tl.transaction

                        AND tl.id = tal.transactionline

                        AND tal.account = acc.id

                        AND acc.id = forecastAccount.custrecord_cash360_account

                        AND forecastAccount.custrecord_cash360_category = category.id

                        AND tl.transaction = tal.transaction

                        AND tl.subsidiary = ${subsidiary}

                        AND trans.trandate BETWEEN
                            TRUNC(ADD_MONTHS(CURRENT_DATE, -3), 'MM')
                            AND LAST_DAY(ADD_MONTHS(CURRENT_DATE, -1))

                        AND forecastAccount.custrecord_cash360_useinprojection = 'T'

                        AND trans.posting != 'F'

                        AND category.name = 'ISR'

                )

            ) / 13, 0) AS weekly_total

        FROM
            customrecord_cash360_accountcategory category,
            customrecord_cash360_categorymanager categorymanager,
            customrecord_cash360_preference pref,
            customlist_cash360_accountcategorytype categorytype

        WHERE
            categorymanager.custrecord_cash360_accountcategory = category.id

            AND categorymanager.custrecord_cash360_preference = pref.id

            AND categorytype.id = category.custrecord_cash360_accountcategorytype

            AND categorymanager.custrecord_cash360_category_use_in_proj = 'T'

            AND pref.custrecord_cash360_subsidiary = ${subsidiary}

            AND category.name = 'ISR'

    ) proj
),

/* MANO DE OBRA */
laborCosts AS (

    SELECT

        p.week_start,

        proj.weekly_total AS total_labor

    FROM periods p

    CROSS JOIN (

        SELECT

            NVL((

                SELECT

                    CASE
                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_INFLOW')
                            THEN (SUM(amount) * -1)

                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_OUTFLOW')
                            THEN SUM(amount)

                    END

                FROM (

                    SELECT
                        tal.amount AS amount,
                        category.id AS categoryId

                    FROM
                        transaction trans,
                        transactionline tl,
                        transactionaccountingline tal,
                        account acc,
                        customrecord_cash360_account forecastAccount,
                        customrecord_cash360_accountcategory category

                    WHERE
                        trans.id = tl.transaction

                        AND tl.id = tal.transactionline

                        AND tal.account = acc.id

                        AND acc.id = forecastAccount.custrecord_cash360_account

                        AND forecastAccount.custrecord_cash360_category = category.id

                        AND tl.transaction = tal.transaction

                        AND tl.subsidiary = ${subsidiary}

                        AND trans.trandate BETWEEN
                            TRUNC(ADD_MONTHS(CURRENT_DATE, -3), 'MM')
                            AND LAST_DAY(ADD_MONTHS(CURRENT_DATE, -1))

                        AND forecastAccount.custrecord_cash360_useinprojection = 'T'

                        AND trans.posting != 'F'

                        AND category.name = 'Mano de Obra Directa'

                )

            ) / 13, 0) AS weekly_total

        FROM
            customrecord_cash360_accountcategory category,
            customrecord_cash360_categorymanager categorymanager,
            customrecord_cash360_preference pref,
            customlist_cash360_accountcategorytype categorytype

        WHERE
            categorymanager.custrecord_cash360_accountcategory = category.id

            AND categorymanager.custrecord_cash360_preference = pref.id

            AND categorytype.id = category.custrecord_cash360_accountcategorytype

            AND categorymanager.custrecord_cash360_category_use_in_proj = 'T'

            AND pref.custrecord_cash360_subsidiary = ${subsidiary}

            AND category.name = 'Mano de Obra Directa'

    ) proj
),

/* OTROS PAGOS RELACIONADOS CON NÓMINA MOD */
otherPayrollPayments AS (

    SELECT

        p.week_start,

        proj.weekly_total AS total_other_payroll

    FROM periods p

    CROSS JOIN (

        SELECT

            NVL((

                SELECT

                    CASE
                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_INFLOW')
                            THEN (SUM(amount) * -1)

                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_OUTFLOW')
                            THEN SUM(amount)

                    END

                FROM (

                    SELECT
                        tal.amount AS amount,
                        category.id AS categoryId

                    FROM
                        transaction trans,
                        transactionline tl,
                        transactionaccountingline tal,
                        account acc,
                        customrecord_cash360_account forecastAccount,
                        customrecord_cash360_accountcategory category

                    WHERE
                        trans.id = tl.transaction

                        AND tl.id = tal.transactionline

                        AND tal.account = acc.id

                        AND acc.id = forecastAccount.custrecord_cash360_account

                        AND forecastAccount.custrecord_cash360_category = category.id

                        AND tl.transaction = tal.transaction

                        AND tl.subsidiary = ${subsidiary}

                        AND trans.trandate BETWEEN
                            TRUNC(ADD_MONTHS(CURRENT_DATE, -3), 'MM')
                            AND LAST_DAY(ADD_MONTHS(CURRENT_DATE, -1))

                        AND forecastAccount.custrecord_cash360_useinprojection = 'T'

                        AND trans.posting != 'F'

                        AND category.name = 'Otros pagos relacionados con nómina MOD'

                )

            ) / 13, 0) AS weekly_total

        FROM
            customrecord_cash360_accountcategory category,
            customrecord_cash360_categorymanager categorymanager,
            customrecord_cash360_preference pref,
            customlist_cash360_accountcategorytype categorytype

        WHERE
            categorymanager.custrecord_cash360_accountcategory = category.id

            AND categorymanager.custrecord_cash360_preference = pref.id

            AND categorytype.id = category.custrecord_cash360_accountcategorytype

            AND categorymanager.custrecord_cash360_category_use_in_proj = 'T'

            AND pref.custrecord_cash360_subsidiary = ${subsidiary}

            AND category.name = 'Otros pagos relacionados con nómina MOD'

    ) proj
),

/* PRESTACIONES MOD */
benefitsMOD AS (

    SELECT

        p.week_start,

        proj.weekly_total AS total_benefits

    FROM periods p

    CROSS JOIN (

        SELECT

            NVL((

                SELECT

                    CASE
                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_INFLOW')
                            THEN (SUM(amount) * -1)

                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_OUTFLOW')
                            THEN SUM(amount)

                    END

                FROM (

                    SELECT
                        tal.amount AS amount,
                        category.id AS categoryId

                    FROM
                        transaction trans,
                        transactionline tl,
                        transactionaccountingline tal,
                        account acc,
                        customrecord_cash360_account forecastAccount,
                        customrecord_cash360_accountcategory category

                    WHERE
                        trans.id = tl.transaction

                        AND tl.id = tal.transactionline

                        AND tal.account = acc.id

                        AND acc.id = forecastAccount.custrecord_cash360_account

                        AND forecastAccount.custrecord_cash360_category = category.id

                        AND tl.transaction = tal.transaction

                        AND tl.subsidiary = ${subsidiary}

                        AND trans.trandate BETWEEN
                            TRUNC(ADD_MONTHS(CURRENT_DATE, -3), 'MM')
                            AND LAST_DAY(ADD_MONTHS(CURRENT_DATE, -1))

                        AND forecastAccount.custrecord_cash360_useinprojection = 'T'

                        AND trans.posting != 'F'

                        AND category.name = 'Prestaciones MOD'

                )

            ) / 13, 0) AS weekly_total

        FROM
            customrecord_cash360_accountcategory category,
            customrecord_cash360_categorymanager categorymanager,
            customrecord_cash360_preference pref,
            customlist_cash360_accountcategorytype categorytype

        WHERE
            categorymanager.custrecord_cash360_accountcategory = category.id

            AND categorymanager.custrecord_cash360_preference = pref.id

            AND categorytype.id = category.custrecord_cash360_accountcategorytype

            AND categorymanager.custrecord_cash360_category_use_in_proj = 'T'

            AND pref.custrecord_cash360_subsidiary = ${subsidiary}

            AND category.name = 'Prestaciones MOD'

    ) proj
),

/* SUELDOS Y SALARIOS */
salaries AS (

    SELECT

        p.week_start,

        proj.weekly_total AS total_salaries

    FROM periods p

    CROSS JOIN (

        SELECT

            NVL((

                SELECT

                    CASE
                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_INFLOW')
                            THEN (SUM(amount) * -1)

                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_OUTFLOW')
                            THEN SUM(amount)

                    END

                FROM (

                    SELECT
                        tal.amount AS amount,
                        category.id AS categoryId

                    FROM
                        transaction trans,
                        transactionline tl,
                        transactionaccountingline tal,
                        account acc,
                        customrecord_cash360_account forecastAccount,
                        customrecord_cash360_accountcategory category

                    WHERE
                        trans.id = tl.transaction

                        AND tl.id = tal.transactionline

                        AND tal.account = acc.id

                        AND acc.id = forecastAccount.custrecord_cash360_account

                        AND forecastAccount.custrecord_cash360_category = category.id

                        AND tl.transaction = tal.transaction

                        AND tl.subsidiary = ${subsidiary}

                        AND trans.trandate BETWEEN
                            TRUNC(ADD_MONTHS(CURRENT_DATE, -3), 'MM')
                            AND LAST_DAY(ADD_MONTHS(CURRENT_DATE, -1))

                        AND forecastAccount.custrecord_cash360_useinprojection = 'T'

                        AND trans.posting != 'F'

                        AND category.name = 'Sueldos y Salarios'

                )

            ) / 13, 0) AS weekly_total

        FROM
            customrecord_cash360_accountcategory category,
            customrecord_cash360_categorymanager categorymanager,
            customrecord_cash360_preference pref,
            customlist_cash360_accountcategorytype categorytype

        WHERE
            categorymanager.custrecord_cash360_accountcategory = category.id

            AND categorymanager.custrecord_cash360_preference = pref.id

            AND categorytype.id = category.custrecord_cash360_accountcategorytype

            AND categorymanager.custrecord_cash360_category_use_in_proj = 'T'

            AND pref.custrecord_cash360_subsidiary = ${subsidiary}

            AND category.name = 'Sueldos y Salarios'

    ) proj
),

/* TIEMPO EXTRA */
extraTime AS (

    SELECT

        p.week_start,

        proj.weekly_total AS total_extra_time

    FROM periods p

    CROSS JOIN (

        SELECT

            NVL((

                SELECT

                    CASE
                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_INFLOW')
                            THEN (SUM(amount) * -1)

                        WHEN UPPER(categorytype.scriptid) IN ('VAL_TYPE_OUTFLOW')
                            THEN SUM(amount)

                    END

                FROM (

                    SELECT
                        tal.amount AS amount,
                        category.id AS categoryId

                    FROM
                        transaction trans,
                        transactionline tl,
                        transactionaccountingline tal,
                        account acc,
                        customrecord_cash360_account forecastAccount,
                        customrecord_cash360_accountcategory category

                    WHERE
                        trans.id = tl.transaction

                        AND tl.id = tal.transactionline

                        AND tal.account = acc.id

                        AND acc.id = forecastAccount.custrecord_cash360_account

                        AND forecastAccount.custrecord_cash360_category = category.id

                        AND tl.transaction = tal.transaction

                        AND tl.subsidiary = ${subsidiary}

                        AND trans.trandate BETWEEN
                            TRUNC(ADD_MONTHS(CURRENT_DATE, -3), 'MM')
                            AND LAST_DAY(ADD_MONTHS(CURRENT_DATE, -1))

                        AND forecastAccount.custrecord_cash360_useinprojection = 'T'

                        AND trans.posting != 'F'

                        AND category.name = 'Tiempo Extra'

                )

            ) / 13, 0) AS weekly_total

        FROM
            customrecord_cash360_accountcategory category,
            customrecord_cash360_categorymanager categorymanager,
            customrecord_cash360_preference pref,
            customlist_cash360_accountcategorytype categorytype

        WHERE
            categorymanager.custrecord_cash360_accountcategory = category.id

            AND categorymanager.custrecord_cash360_preference = pref.id

            AND categorytype.id = category.custrecord_cash360_accountcategorytype

            AND categorymanager.custrecord_cash360_category_use_in_proj = 'T'

            AND pref.custrecord_cash360_subsidiary = ${subsidiary}

            AND category.name = 'Tiempo Extra'

    ) proj
)

/* RESULTADO FINAL */
SELECT

    p.week_start AS period,

    'OUTFLOW' AS type,

    NVL(ap.total_ap,0) AS accounts_payable,

    NVL(po.total_po,0) AS purchase_orders,

    NVL(et.total_taxes,0) AS employer_taxes,

    NVL(isr.total_isr,0) AS isr,

    NVL(lc.total_labor,0) AS labor_costs,

    NVL(opp.total_other_payroll,0) AS other_payroll_payments,

    NVL(bm.total_benefits,0) AS benefits_mod,

    NVL(sal.total_salaries,0) AS salaries,

    NVL(ext.total_extra_time,0) AS extra_time,

    (
        NVL(ap.total_ap,0)
        +
        NVL(po.total_po,0)
        +
        NVL(et.total_taxes,0)
        +
        NVL(isr.total_isr,0)
        +
        NVL(lc.total_labor,0)
        +
        NVL(opp.total_other_payroll,0)
        +
        NVL(bm.total_benefits,0)
        +
        NVL(sal.total_salaries,0)
        +
        NVL(ext.total_extra_time,0)
    ) AS total_outflow

FROM periods p

LEFT JOIN accountsPayable ap
    ON ap.week_start = p.week_start

LEFT JOIN purchaseOrders po
    ON po.week_start = p.week_start

LEFT JOIN employerTaxes et
    ON et.week_start = p.week_start

LEFT JOIN isrTaxes isr
    ON isr.week_start = p.week_start

LEFT JOIN laborCosts lc
    ON lc.week_start = p.week_start

LEFT JOIN otherPayrollPayments opp
    ON opp.week_start = p.week_start

LEFT JOIN benefitsMOD bm
    ON bm.week_start = p.week_start

LEFT JOIN salaries sal
    ON sal.week_start = p.week_start

LEFT JOIN extraTime ext
    ON ext.week_start = p.week_start

ORDER BY
    TO_DATE(p.week_start,'DD/MM/YYYY')

            `;

            log.debug({
                title: 'SuiteQL',
                details: suiteQL
            });

            const results = query.runSuiteQL({
                query: suiteQL
            }).asMappedResults();

            log.debug({
                title: 'Raw Results',
                details: JSON.stringify(results)
            });

            const periods = results.map((row, index) => {

                return {
                    [row.period]: {

                        startDate:
                            index === 0
                                ? null
                                : row.period,

                        accountsPayable:
                            Number(row.accounts_payable || 0),

                        purchaseOrders:
                            Number(row.purchase_orders || 0),

                        employerTaxes:
                            Number(row.employer_taxes || 0),

                        isr:
                            Number(row.isr || 0),

                        laborCosts:
                            Number(row.labor_costs || 0),

                        otherPayrollPayments:
                            Number(row.other_payroll_payments || 0),

                        benefitsMOD:
                            Number(row.benefits_mod || 0),

                        salaries:
                            Number(row.salaries || 0),

                        extraTime:
                            Number(row.extra_time || 0),

                        totalOutflow:
                            Number(row.total_outflow || 0)
                    }
                };
            });

            return JSON.stringify({
                type: 'OUTFLOW',
                subsidiary: subsidiary,
                periods: periods
            });

        } catch (e) {

            log.error({
                title: 'RESTLET ERROR',
                details: JSON.stringify({
                    message: e.message,
                    stack: e.stack
                })
            });

            return JSON.stringify({
                success: false,
                error: e.message,
                stack: e.stack
            });
        }
    };

    return {
        get
    };
});