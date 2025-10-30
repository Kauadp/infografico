rm(list = ls())

library(tidyverse)
library(jsonlite)
library(dunn.test)
library(MASS)


dados <- read.csv('bling_export.csv', sep = ";")

table(dados$Fornecedor)

dados <- dados |> 
  mutate(
    loja = case_when(
      Fornecedor == "-" | Fornecedor == 'HIGH COMPANY LTDA' ~ "High",
      Fornecedor == "VCI - VANGUARD CONFECCOES IMPORTADAS S/A" ~ "Aramis",
      Fornecedor == "PASQUINI E PASQUINI CONFECCOES LTDA." ~ "Acostamento",
      Fornecedor == "ZZAB Comercio de Calcados Ltda. AREZZO" | Fornecedor == "ZZAB Comercio de Calcados Ltda. VANS" ~ "ZZAB Comercio de Calcados Ltda."
      )
  )

table(dados$loja)

dados <- dados |>
  mutate(
    loja = case_when(
      loja == "ZZAB Comercio de Calcados Ltda." & str_starts(Descrição, "CALCADOS") ~ "Arezzo",
            loja == "ZZAB Comercio de Calcados Ltda." & !str_starts(Descrição, "CALCADOS") ~ "Vans",
      
      TRUE ~ loja
    )
  )

table(dados$Data.de.emissão)

dados <- dados |> 
  mutate(
    data = dmy_hms(Data.de.emissão),
    data_emissao = as.Date(data),
    hora_emissao = hour(data)
  )

str(dados)

dados <- dados |> 
  mutate(
    Quantidade = parse_number(Quantidade, locale = locale(decimal_mark = ",")),
    Preço.de.custo = parse_number(Preço.de.custo, locale = locale(decimal_mark = ",")),
    Valor.total = parse_number(Valor.total, locale = locale(decimal_mark = ",")),
    Valor.unitário = parse_number(Valor.unitário, locale = locale(decimal_mark = ",")),
    Valor.total.líquido = parse_number(Valor.total.líquido, locale = locale(decimal_mark = ","))
  ) 

dados <- dados |> 
  mutate(
    Preço.de.custo = case_when(
      loja == "Arezzo" ~ 42,
      TRUE ~ Preço.de.custo)
  )

dados <- dados |> 
  mutate(
    custo_total = Quantidade*Preço.de.custo
  )

peak_demanda <- as.data.frame.matrix(table(dados$data_emissao, dados$hora_emissao)) |>
  rownames_to_column(var = "data_emissao") |>
  pivot_longer(
    cols = -data_emissao,
    names_to = "hora_emissao",
    values_to = "contagem"
  ) |>
  mutate(
    hora_emissao = as.factor(hora_emissao),
    data_emissao = ymd(data_emissao)
  )

peak_demanda <- peak_demanda |> 
  mutate(
  hora_emissao = as.factor(hora_emissao),
  dia_da_semana = factor(weekdays(data_emissao, abbreviate = TRUE)) 
)

lm <- glm.nb(contagem ~ dia_da_semana + hora_emissao, data = peak_demanda)

write.csv(dados, "dados.csv", row.names = F)

