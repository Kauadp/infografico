rm(list = ls())

library(tidyverse)

dados <- read.csv('bling_export.csv', sep = ";")

table(dados$Fornecedor)


table(dados$Data.de.emissão)

dados$Data.de.emissão <- str_extract(dados$Data.de.emissão, "[0-9]+/[0-9]+/[0-9]+")
table(dados$Data.de.emissão)

high <- dados |> 
  filter(Fornecedor == "-" | Fornecedor == 'HIGH COMPANY LTDA')

dados |> 
  filter(Nome.da.Loja == "Vans")

table(high$Data.de.emissão)

high |> 
  group_by(Data.de.emissão) |> 
  summarise(
    (Valor.total)
  )

arezzo <- dados |> 
  filter(Fornecedor == "ZZAB Comercio de Calcados Ltda. AREZZO")

table(dados$Descrição)

dados$Descrição

str(arezzo)

arezzo <- arezzo %>%
  mutate(
    # 1. Converte 'Quantidade' para numérico, usando o locale (separador decimal = vírgula)
    Quantidade = parse_number(Quantidade, locale = locale(decimal_mark = ",")),
    
    # 2. Converte 'Preço.de.custo' para numérico, usando o locale
    `Preço.de.custo` = parse_number(`Preço.de.custo`, locale = locale(decimal_mark = ",")),
    
    Valor.total = parse_number(`Valor.total`, locale = locale(decimal_mark = ","))
  )


arezzo$custo_total <- arezzo$Quantidade*arezzo$Preço.de.custo

sum(arezzo$Valor.total)

sum(arezzo$custo_total, na.rm = T)

arezzo_filtrado <- arezzo %>%
  filter(str_starts(Descrição, "CALCADOS"))

sum(arezzo_filtrado$Valor.total)

high |> 
  filter(Número == 10811)

write.csv(dados, "dados.csv", row.names = F)

