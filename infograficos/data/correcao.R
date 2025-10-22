rm(list = ls())

library(tidyverse)

dados <- read.csv('bling_export.csv', sep = ";")

table(dados$Fornecedor)


table(dados$Data.de.emissão)

dados$Data.de.emissão <- str_extract(dados$Data.de.emissão, "[0-9]+/[0-9]+/[0-9]+")
table(dados$Data.de.emissão)

high <- dados |> 
  filter(Fornecedor == "-" | Fornecedor == "HIGH COMPANY LTDA")

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

str_detect(dados$Descrição, "CALCADOS")


high |> 
  filter(Número == 10811)

write.csv(dados, "dados.csv", row.names = F)

